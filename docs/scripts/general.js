
(function($, window, document) {
  $(function() {
    function scrollBackground() {
      const bars = $('div.bar');
      const outer = $('div#outer');
      const scrollMax = Math.floor(bars.height() - $(window).height());
      const newPos = Math.round(outer[0].scrollTop / outer[0].scrollTopMax * scrollMax);
      $('div.bar').css('background-position-y', - newPos + 'px');
    }    
    $('div#outer').scroll(scrollBackground);
    scrollBackground();
  });
}(window.jQuery, window, document));
