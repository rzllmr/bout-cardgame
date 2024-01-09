
(function($, window, document) {
  $(function() {
    const {ipcRenderer} = require('electron');
    const {dialog} = require('electron').remote;
    const fs = require('fs');
    const path = require('path');

    const generator = new Generator();

    let idxPos = 0;
    let mode = 'single';
    let dimension = {
      'single': [744, 1038],
      'texture': [744 * 10, 1038 * 7],
      'print': [744 * 9, 1038 * 6]
    };
    let columnCount = 10;

    $('#mode').on('click', (event) => {
      switch(mode) {
        case 'single':
          mode = 'texture';
          $('.card-board')[0].className = 'card-board texture';
          $('.card-board').css('background-color', 'white');
          columnCount = 10;
          break;
        case 'texture':
          mode = 'print';
          $('.card-board')[0].className = 'card-board print';
          $('.card-board').css('background-color', 'white');
          columnCount = 9;
          break;
        case 'print':
          mode = 'single';
          $('.card-board').css('background-color', 'transparent');
          break;
      }
      event.target.innerHTML = mode;
      if (mode != 'single') {
        $('#view')[0].scrollTop = 0;
        $('#view')[0].scrollLeft = 0;
        idxPos = 0;
      }
    });

    $('#load').on('click', () => {
      dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{name: 'Spreadsheet', extensions: ['csv']}]
      }).then(result => {
        if (result.canceled) return;
        const csvPath = result.filePaths[0];
        fs.readFile(csvPath, 'utf8', (error, data) => {
          if (error) throw error;
          const rows = $.csv.toObjects(data);
          if (rows.length === 0) {
            console.log('reading file failed');
            return;
          }

          const imageDir = path.join(path.dirname(csvPath), 'images');
          generator.scanImages(imageDir);
          for (let idx = 0; idx < rows.length; idx++) {
            generator.card((idx+1).toString(), rows[idx]);
          }
          $('#card-template').hide();
        });
      });
    });

    $('#save').on('click', () => {
      dialog.showSaveDialog({
        properties: [],
        filters: [{name: 'Image File', extensions: ['png', 'jpg', 'bmp']}]
      }).then(result => {
        if (!result.canceled) {
          const path = result.filePath;

          $('#save i')[0].className = 'fa fa-spinner fa-spin';
          $('#preparation button').prop('disabled', true);

          $('#preparation').hide();
          if (mode != 'single') $('#view').css('overflow', 'visible');

          const dim = dimension[mode];
          ipcRenderer.invoke('render', path, dim[0], dim[1], mode == 'print').then((response) => {
            setTimeout(() => {
              $('#preparation').show();
              if (mode != 'single') $('#view').css('overflow', 'hidden');
            }, 100);
          });
        }
      });
    });
    ipcRenderer.on('saved', () => {
      $('#save i')[0].className = 'fa fa-save';
      $('#preparation button').prop('disabled', false);
    });

    $('#corner').on('click', () => {
      switch ($('#corner i')[0].className) {
        case 'fa fa-square-o':
          $('.card').css('border-radius', '30px');
          $('#corner i')[0].className = 'fa fa-circle-o';
          break;
        case 'fa fa-circle-o':
          $('.card').css('border-radius', '0');
          $('#corner i')[0].className = 'fa fa-square-o';
          break;
      }
    });

    $('#previous').on('click', () => {
      idxPos = Math.min(Math.max(idxPos - 1, 0), 53);
      $('#view')[0].scrollTop = Math.floor(idxPos / columnCount) * 1038;
      $('#view')[0].scrollLeft = (idxPos % columnCount) * 744;
    });

    $('#next').on('click', () => {
      idxPos = Math.min(Math.max(idxPos + 1, 0), 53);
      $('#view')[0].scrollTop = Math.floor(idxPos / columnCount) * 1038;
      $('#view')[0].scrollLeft = (idxPos % columnCount) * 744;
    });
  });
}(window.jQuery, window, document));

class Generator {
  constructor() {
    this.images = [];
    this.imagePool = [];
    this.onlyTuts = false;
    this.design = 'default';
  }

  scanImages(dirPath) {
    const fs = require('fs');
    if (!fs.existsSync(dirPath)) dirPath = './data/images/';
    this.images = fs.readdirSync(dirPath);
    this.imagePool = this.images.slice();
  }

  getImage(fileName = '') {
    let imageIdx = -1;
    if (fileName == '') {
      imageIdx = Math.floor(Math.random() * (this.imagePool.length - 1));
      fileName = this.imagePool[imageIdx];
    } else {
      imageIdx = this.images.findIndex((item) => item.slice(0, -4) == fileName);
      if (imageIdx > -1) fileName = this.images[imageIdx];
      else fileName = this.images[0];
    }
    if (fileName != '') {
      imageIdx = this.imagePool.indexOf(fileName);
      if (imageIdx > -1) {
        this.imagePool.splice(imageIdx, 1);
        if (this.imagePool.length == 0) this.imagePool = this.images.slice();
      }
    }
    return fileName;
  }

  card(id, entry) {
    if (this.onlyTuts && !entry['Tutorial']) return;
    const cardItem = $("#card-template").clone();

    const imageFile = this.getImage(entry['Image']);
    cardItem.find('div.artwork').attr('style', `background-image: url("data/images/${imageFile}")`);

    cardItem.find('div.life').text(entry['Life']);
    cardItem.find('div.title').text(entry['Name']);

    let abilityHint = cardItem.find('div.ability-hint:first').clone();
    cardItem.find('div.ability-hint').remove();
    for (let i=3; i>0; i--) {
      const type = entry[`Hint ${i}`];
      if (type) {
        abilityHint.attr('style', `background-image: url("data/design/${this.design}/hints/hint_${i}_${type}.png")`);
        abilityHint.find('img').remove();
        const typeIcon = $(this.icon(`hint-${type}`));
        typeIcon[0].className = `hint-symbol-${i}`;
        typeIcon.appendTo(abilityHint);
        abilityHint.insertBefore(cardItem.find('table.abilities'));
        abilityHint = abilityHint.clone();
      }
    }

    const abilityTable = cardItem.find('table.abilities');
    abilityTable.find('tr').remove();
    for (let i=1; i<4; i++) {
      if (entry[`Dice ${i}`] === '' && entry[`Effects ${i}`] === '') continue;
      const type = entry[`Type ${i}`];
      const dice = entry[`Dice ${i}`];
      let diceIcons = this.icon(type);
      switch (dice) {
        case '0': diceIcons += this.icon('none'); break;
        case '1': diceIcons += this.icon('required'); break;
        case '2': diceIcons += this.icon('required') +'<br>'+ this.icon('required'); break;
        case '1-2': diceIcons += this.icon('required') +'<br>'+ this.icon('optional'); break;
      }

      const effects = this.format(entry[`Effects ${i}`]).split('\n');
      let ability = `<td class="ability" rowspan="${effects.length}">${diceIcons}</td>`;
      for (let effect of effects) {
        effect = effect.split(': ');
        if (effect.length == 1) {
          effect.push(effect[0]);
          if (dice === '0') effect[0] = this.icon('none');
          else effect[0] = this.icon('required');
        }
        const tableItem = `<tr>${ability}<td class="outcomes"><div class="condition">...${effect[0]}:</div><div class="effect">${effect[1]}</div></td></tr>`;
        $(tableItem).appendTo(abilityTable);
        if (ability !== '') ability = '';
      }
    }

    if (entry['Description'] != '') cardItem.find('div.description span').text(entry['Description']);

    id = '0'.repeat(3 - id.length) + id;
    cardItem.find('div.identifier').text(id);
    cardItem.removeAttr('id');
    cardItem.show();

    cardItem.appendTo('.card-board');
  }

  format(text) {
    const replacements = {
      '<=': '&le;',
      '>=': '&ge;',
      // 'D.1': this.icon('D-1'),
      // 'D.2': this.icon('D-2'),
      // 'D.l': this.icon('D-l'),
      // 'D.h': this.icon('D-h'),
      // 'D.s': this.icon('D-s'),
      // 'D.r1': this.icon('D-r1'),
      // 'D.r2': this.icon('D-r2'),
      // 'D': this.icon('D')
    };
    const RE = new RegExp(Object.keys(replacements).join('|').replace(/\./g, '\\.'), 'g');
    return text.replace(RE, (matched) => {
      return replacements[matched];
    });
  }

  icon(name) {
    return $('#custom-icons > #' + name)[0].outerHTML;
  }
}
