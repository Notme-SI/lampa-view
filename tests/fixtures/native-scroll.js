/* Lampa Scroll, extracted unmodified from yumata/lampa app.min.js for regression tests. */
  function Scroll() {
    var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var _self = this;

    var html = Template.js('scroll');
    var body = html.querySelector('.scroll__body');
    var content = html.querySelector('.scroll__content');
    var screen = Platform.screen('tv');
    var scroll_position = 0;
    var scroll_animating = false;
    var time_call_end = Date.now();
    var scroll_time = 0,
        scroll_step = params.step || 150;
    if (params.horizontal) html.classList.toggle('scroll--horizontal', true);
    if (params.mask) html.classList.toggle('scroll--mask', true);
    if (params.over) html.classList.toggle('scroll--over', true);
    if (params.nopadding) html.classList.toggle('scroll--nopadding', true);
    if (params.notransition) body.classList.toggle('notransition', true);

    function wheel(e) {
      var parent = $(e.target).parents('.scroll');
      var inner = onTheRightSide(e, true);
      if (!params.horizontal && $(html).is(parent[0])) inner = true;

      if (Date.now() - scroll_time > 200 && inner) {
        scroll_time = Date.now();

        if (e.wheelDelta / 120 > 0) {
          if (_self.onWheel) _self.onWheel(-scroll_step);else _self.wheel(-scroll_step);
        } else {
          if (_self.onWheel) _self.onWheel(scroll_step);else _self.wheel(scroll_step);
        }
      }
    } // Обрабатываем скролл колесом мыши


    html.addEventListener('mousewheel', wheel);
    html.addEventListener('wheel', wheel); // Экспортируемые методы и свойства

    html.Scroll = _self; // Если это телевизор и есть сенсорный экран, то делаем скролл тачем

    if (screen) {
      var movestart = function movestart(e) {
        start_position = params.horizontal ? e.clientX : e.clientY;
        end_position = start_position;
        move_position = start_position;
        body.toggleClass('notransition', true);
      };

      var move = function move(e) {
        end_position = params.horizontal ? e.clientX : e.clientY;

        if (move_position && end_position) {
          var delta = move_position - end_position;
          var direct = params.horizontal ? 'left' : 'top';
          var scrl = scroll_position,
              scrl_padding = parseInt(window.getComputedStyle(content, null).getPropertyValue('padding-' + direct));
          var max = params.horizontal ? 30000 : body.offsetHeight;
          max -= params.horizontal ? html.offsetWidth : html.offsetHeight;
          max += scrl_padding * 2;
          scrl -= delta;
          scrl = Math.min(0, Math.max(-max, scrl));
          scrl = maxOffset(scrl);
          scroll_position = scrl;
          translateScroll();
          move_position = end_position;
        }
      };

      var moveend = function moveend(e) {
        end_position = 0;
        start_position = 0;
        move_position = 0;
        body.toggleClass('notransition', false);
        scrollEnded();
        if (_self.onAnimateEnd) _self.onAnimateEnd();
      };

      html.addEventListener('scroll', function (e) {
        html.scrollTop = 0;
        html.scrollLeft = 0;
      });
      var start_position = 0;
      var move_position = 0;
      var end_position = 0;
      html.addEventListener('touchstart', function (e) {
        movestart(e.touches[0] || e.changedTouches[0]);
      });
      html.addEventListener('touchmove', function (e) {
        move(e.touches[0] || e.changedTouches[0]);
      });
      html.addEventListener('touchend', moveend);
    } else {
      var native_scroll_animate = false;
      var native_scroll_timer = null;
      html.addEventListener('scroll', function () {
        clearTimeout(native_scroll_timer);
        native_scroll_timer = setTimeout(function () {
          if (_self.onAnimateEnd) _self.onAnimateEnd();
        }, 300);

        if (!native_scroll_animate) {
          native_scroll_animate = true;
          requestAnimationFrame(function () {
            native_scroll_animate = false;
            scroll_position = -(params.horizontal ? html.scrollLeft : html.scrollTop);
            scrollEnded();
          });
        }
      });
    }
    /**
     * Определяет, находится ли курсор на правой стороне скрола
     * @param {Event} e - событие мыши
     * @param {boolean} inleft - если true, то проверяет левую сторону
     * @returns {boolean}
     */


    function onTheRightSide(e) {
      var inleft = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var offset = content.getBoundingClientRect().left;
      var width = window.innerWidth - offset;
      var position = e.clientX - offset;
      return params.horizontal ? position > width / 2 : inleft ? position < width / 2 : false;
    }
    /**
     * Максимально возможный отступ
     * @param {number} offset - желаемый отступ
     * @returns {number}
     */


    function maxOffset(offset) {
      var w = params.horizontal ? html.offsetWidth : html.offsetHeight;
      var p = parseInt(window.getComputedStyle(content, null).getPropertyValue('padding-' + (params.horizontal ? 'left' : 'top')));
      var s = body[params.horizontal ? 'scrollWidth' : 'scrollHeight'];
      offset = Math.min(0, offset);
      offset = Math.max(-(Math.max(s + p * 2, w) - w), offset);
      return offset;
    }
    /**
     * Вызов обновления скрола и вызов события конеца скрола
     */


    function scrollEnded() {
      if (_self.onScroll) _self.onScroll(!screen ? html[params.horizontal ? 'scrollLeft' : 'scrollTop'] : -scroll_position);else Layer.visible(html);
      if (_self.onEnd && _self.isEnd()) _self.onEnd();
    }
    /**
     * Перемещает скролл в указанную позицию без анимации
     */


    function translateScroll() {
      if (!screen) {
        html[params.horizontal ? 'scrollLeft' : 'scrollTop'] = -scroll_position;
      } else {
        body.style['-webkit-transform'] = 'translate3d(' + Math.round(params.horizontal ? scroll_position : 0) + 'px, ' + Math.round(params.horizontal ? 0 : scroll_position) + 'px, 0px)';
      }
    }
    /**
     * Начинает анимацию прокрутки к указанной позиции
     * @param {number} to_position - куда нужно прокрутить
     */


    function startScroll(to_position) {
      // Зачем начинать анимацию, если мы уже там?
      if (scroll_position == to_position) {
        if (!_self.isFilled()) scrollEnded();
        return;
      }

      scroll_position = to_position;
      translateScroll();

      if (Storage.field('animation')) {
        scroll_animating = true;
        body.addEventListener('webkitTransitionEnd', function () {
          if (Date.now() - time_call_end < 300) return;
          time_call_end = Date.now();
          scroll_animating = false;
          scrollEnded();
          if (_self.onAnimateEnd) _self.onAnimateEnd();
        }, {
          once: true
        });
      } else {
        scrollEnded();
        if (_self.onAnimateEnd) _self.onAnimateEnd();
      }
    }
    /**
     * Получить позицию элемента относительно скрола
     * @param {HTMLElement|jQuery} elem - элемент, который должен быть виден
     * @param {boolean} tocenter - выровнять элемент по центру скрола
     * @returns {number}
     */


    function getElementPosition(elem, tocenter) {
      var dir = params.horizontal ? 'left' : 'top',
          siz = params.horizontal ? 'offsetWidth' : 'offsetHeight';
      var target = elem instanceof jQuery ? elem[0] : elem;
      var p = tocenter ? parseInt(window.getComputedStyle(content, null).getPropertyValue('padding-' + (params.horizontal ? 'left' : 'top'))) : 0;
      var ofs_elm = target.getBoundingClientRect()[dir],
          ofs_box = body.getBoundingClientRect()[dir],
          center = ofs_box + (tocenter ? content[siz] / 2 - target[siz] / 2 - p : 0),
          scrl = Math.min(0, center - ofs_elm);
      scrl = maxOffset(scrl);
      return scrl;
    }
    /**
     * Добавить обработку свайпа вниз имитации скрытия шторки
     * @param {function} call - функция, которая будет вызвана при свайпе вниз
     */


    this.addSwipeDown = function (call) {
      if (window.innerWidth > 480) return;
      var s = 0;
      var t = 0;
      html.addEventListener('touchstart', function (e) {
        var point = e.touches[0] || e.changedTouches[0];

        if (s == 0) {
          s = point.clientY;
          t = Date.now();
        }
      });
      html.addEventListener('touchmove', function (e) {
        var point = e.touches[0] || e.changedTouches[0];

        if (s !== 0) {
          if (point.clientY - s > 50 && html.scrollTop == 0 && Date.now() - t < 100) {
            s = 0;
            call();
          }
        }
      });
      html.addEventListener('touchend', function (e) {
        s = 0;
      });
    };
    /**
     * Вызвать прокрутку
     * @param {number} size - на сколько пикселей прокрутить
     */


    this.wheel = function (size) {
      var direct = params.horizontal ? 'left' : 'top';
      var scrl = scroll_position,
          scrl_offset = html.getBoundingClientRect()[direct],
          scrl_padding = parseInt(window.getComputedStyle(content, null).getPropertyValue('padding-' + direct));

      if (params.scroll_by_item) {
        var pos = body.scroll_position;
        pos = pos || 0;
        var items = Array.from(body.children);
        pos += size > 0 ? 1 : -1;
        pos = Math.max(0, Math.min(items.length - 1, pos));
        body.scroll_position = pos;
        var item = items[pos],
            ofst = item.getBoundingClientRect()[direct];
        size = ofst - scrl_offset - scrl_padding;
      }

      var max = params.horizontal ? 30000 : body.offsetHeight;
      max -= params.horizontal ? html.offsetWidth : html.offsetHeight;
      max += scrl_padding * 2;
      scrl -= size;
      scrl = Math.min(0, Math.max(-max, scrl));
      scrl = maxOffset(scrl);
      startScroll(scrl);
    };
    /**
     * Обновить позицию скрола, чтобы элемент был виден
     * @param {HTMLElement|jQuery} elem - элемент, который должен быть виден
     * @param {boolean} tocenter - выровнять элемент по центру скрола
     * @returns {void}
     */


    this.update = function (elem, tocenter) {
      startScroll(getElementPosition(elem, tocenter));
    };
    /**
     * Обновить позицию скрола, чтобы элемент был виден без анимации
     * @param {HTMLElement|jQuery} elem - элемент, который должен быть виден
     * @param {boolean} tocenter - выровнять элемент по центру скрола
     * @returns {void}
     */


    this.immediate = function (elem, tocenter) {
      body.toggleClass('notransition', true);
      scroll_position = getElementPosition(elem, tocenter);
      translateScroll();
      setTimeout(function () {
        body.toggleClass('notransition', false);
      }, 5);
    };
    /**
     * Сдвинуть скролл на указанное количество пикселей без анимации
     * @param {number} shift - на сколько пикселей сдвинуть скролл
     * @returns {void}
     */


    this.shift = function (shift) {
      body.toggleClass('notransition', true);
      scroll_position = maxOffset(scroll_position - shift);
      translateScroll();
      setTimeout(function () {
        body.toggleClass('notransition', false);
      }, 5);
    };
    /**
     * Получить параметры скрола
     * @returns {Object}
     */


    this.vieport = function () {
      var vieport = {};

      if (!screen) {
        vieport.position = html[params.horizontal ? 'scrollLeft' : 'scrollTop'], vieport.body = body[params.horizontal ? 'scrollWidth' : 'scrollHeight'], vieport.content = html[params.horizontal ? 'offsetWidth' : 'offsetHeight'];
      } else {
        vieport.position = scroll_position;
        vieport.body = body[params.horizontal ? 'offsetWidth' : 'offsetHeight'];
        vieport.content = html[params.horizontal ? 'offsetWidth' : 'offsetHeight'];
      }

      return vieport;
    };
    /**
     * Проверить, достигнут ли конец скрола
     * @param {number} [end_ratio] - соотношение для определения конца скрола (1 - конец, 2 - середина и т.д.)
     * @returns {boolean}
     */


    this.isEnd = function (end_ratio) {
      var vieport = this.vieport();
      if (vieport.body < vieport.content) return vieport.position <= 0;
      return vieport.body - vieport.content * Math.max(1, end_ratio || params.end_ratio || 1) < Math.abs(vieport.position);
    };
    /**
     * Проверить, заполнен ли скролл контентом
     * @returns {boolean}
     */


    this.isFilled = function () {
      var vieport = this.vieport();
      return vieport.body > vieport.content;
    };
    /**
     * Добавить элемент в скролл
     * @param {HTMLElement|jQuery} object - элемент для добавления
     * @returns {void}
     */


    this.append = function (object) {
      body.append(object);
    };
    /**
     * Добавить элемент в начало скрола
     * @param {HTMLElement|jQuery} object - элемент для добавления
     * @returns {void}
     */


    this.prepend = function (object) {
      body.prepend(object);
    };
    /**
     * Установить высоту скрола с учетом вычитаемого элемента и вычитом шапки
     * @param {HTMLElement|jQuery} minus - элемент, высота которого будет вычтена из высоты скрола
     * @returns {void}
     */


    this.minus = function (minus) {
      html.classList.add('layer--wheight');
      html.mheight = minus instanceof jQuery ? minus[0] : minus;
    };
    /**
     * Установить высоту скрола с учетом вычитаемого элемента
     * @param {HTMLElement|jQuery} minus - элемент, высота которого будет вычтена из высоты скрола
     * @returns {void}
     */


    this.height = function (minus) {
      html.classList.add('layer--height');
      html.mheight = minus instanceof jQuery ? minus[0] : minus;
    };
    /**
     * Получить тело скрола
     * @param {boolean} js - вернуть в виде DOM-элемента, а не jQuery
     * @returns {HTMLElement|jQuery}
     */


    this.body = function (js) {
      return js ? body : $(body);
    };
    /**
     * Получить HTML скрола
     * @param {boolean} js - вернуть в виде DOM-элемента, а не jQuery
     * @returns {HTMLElement|jQuery}
     */


    this.render = function (js) {
      return js ? html : $(html);
    };
    /**
     * Очистить скролл от элементов
     * @returns {void}
     */


    this.clear = function () {
      body.innerHTML = '';
    };
    /**
     * Получить параметры скрола
     * @returns {Object}
     */


    this.params = function () {
      return params;
    };
    /**
     * Получить текущую позицию скрола
     * @returns {number}
     */


    this.position = function () {
      return scroll_position;
    };
    /**
     * Восстановить позицию скрола 
     * Используется после detach активности, скролл сбивается и после start активности его нужно восстановить
     * @returns {void}
     */


    this.restorePosition = function () {
      if (Platform.screen('mobile')) translateScroll();
    };
    /**
     * Отключить паддинги у скрола
     * @returns {void}
     */


    this.nopadding = function () {
      html.classList.toggle('scroll--nopadding', true);
    };
    /**
     * Cбросить позицию скрола в 0
     * @returns {void}
     */


    this.reset = function () {
      scroll_position = 0;
      translateScroll();
    };
    /**
     * Проверить, анимируется ли скролл в данный момент
     * @returns {boolean}
     */


    this.animated = function () {
      return scroll_animating ? true : false;
    };
    /**
     * Удалить скролл
     * @returns {void}
     */


    this.destroy = function () {
      scroll_animating = false;
      html.remove();
    };
  }
