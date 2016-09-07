var H5P = H5P || {};

/**
 * ClickToReveal module
 *
 * @param {jQuery} $
 */
H5P.ClickToReveal = (function ($, Audio, JoubelUI) {

  /**
   * Initialize module.
   *
   * @param {Object} params Behavior settings
   * @param {Number} id Content identification
   * @returns {C} self
   */
  function C(params, id) {
    var self = this;

    H5P.EventDispatcher.call(this);

    self.contentId = self.id = id;

    // Set default behavior.
    self.params = $.extend({
      title: "Card",
      description: "Click to reveal more information about the card clicked.",
      retry: "Retry",
      cards: [
        {
          thumbnail_image: undefined,
		  media: undefined,
		  text: ''
        },
        {
          thumbnail_image: undefined,
		  media: undefined,
		  text: ''
        }
      ]
    }, params);

    self._current = -1;
    self._clicked = [];
    self.$images = [];
    self.audios = [];
  }

  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Attach h5p inside the given container.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var self = this;
    self.$inner = $container
      .addClass('h5p-clicktoreveal')
      .append($('' +
      '<div class="h5p-clicktoreveal-title"><div class="h5p-clicktoreveal-title-inner">' + self.params.title + '</div></div>' +
      '<div class="h5p-clicktoreveal-description">' + self.params.description + '</div>'
      ));

	self.initThumbnails(self.params.cards)
      .appendTo(self.$inner);
	
    self.initCards(self.params.cards)
      .appendTo(self.$inner);

    self.on('reset', function () {
      self.reset();
    });

    self.on('resize', self.resize);
    self.trigger('resize');
  };

  /**
   * Called when all cards have been loaded.
   */
  C.prototype.updateImageSize = function () {
    var self = this;

    // Find highest card content
    var relativeHeightCap = 15;
    var height = 0;
    var i;
    var foundImage = false;
    for (i = 0; i < self.params.cards.length; i++) {
      var card = self.params.cards[i];
      var $card = self.$current.find('.h5p-clicktoreveal-card-content');

      if (card.media === undefined) {
        continue;
      }
	  
	  foundImage = true;
	  
	  var imageHeight = card.media.params.file.height / card.media.params.file.width * $card.get(0).getBoundingClientRect().width;

	  if (imageHeight > height) {
		height = imageHeight;
	  }
    }

    if (foundImage) {
      var relativeImageHeight = height / parseFloat(self.$inner.css('font-size'));
      if (relativeImageHeight > relativeHeightCap) {
        relativeImageHeight = relativeHeightCap;
      }
      self.$images.forEach(function ($img) {
			$img.parent().css('height', relativeImageHeight + 'em');
      });
    }
  };

  /**
   * Adds tip to a card
   *
   * @param {jQuery} $card The card
   * @param {String} [side=front] Which side of the card. Wil always be 'front'
   * @param {Number} [index] Index of card
   */
  C.prototype.addTipToCard = function($card, side, index) {
    var self = this;

    // Make sure we have a side
    if (side !== 'back') {
      side = 'front';
    }

    // Make sure we have an index

    if (index === undefined) {
      index = self.$current.index();
    }

    // Remove any old tips
    $card.find('.joubel-tip-container').remove();

    // Add new tip if set and has length after trim
    var tips = self.params.cards[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      var tip = tips[side].trim();
      if (tip.length) {
        $card.find('.h5p-clicktoreveal-card-text-wrapper').append(JoubelUI.createTip(tip));
      }
    }
  };
  
  /**
   * Creates all thumbnail images and appends them to thumbnail wrapper.
   *
   * @param {Array} cards Card parameters
   * @returns {*|jQuery|HTMLElement} Card wrapper set
   */
  C.prototype.initThumbnails = function (cards) {
    var self = this;
    var loaded = 0;
	var initLoad = cards.length;

    self.$thumbnailwrapperSet = $('<div>', {
      'class': 'h5p-clicktoreveal-thumbnailwrap-set'
    });

    var setCardSizeCallback = function () {
      loaded++;
	  
	  /*If uncommented, editor does not load in Course Presentation*/
      /* if (loaded === initLoad) {
        self.resize();
      } */
    };


    for (var i = 0; i < cards.length; i++) {
	  
      // Load cards progressively
	  if (i >= initLoad) {
        break;
      }
    
      var $thumbnailWrapper = self.createThumbnail(cards[i], setCardSizeCallback);

      // Set current thumbnail
      if (i === 0) {
        $thumbnailWrapper.addClass('h5p-clicktoreveal-current-thumbnail');
        self.$currentThumbnail = $thumbnailWrapper;
      }

      self.$thumbnailwrapperSet.append($thumbnailWrapper);
    }

    return self.$thumbnailwrapperSet;
  };
  
  /**
   * Create a single thumbnail
   *
   * @param {Object} card Card parameters
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card wrapper
   */
  C.prototype.createThumbnail = function (card, setCardSizeCallback) {
    var self = this;
    var $thumbnailWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-thumbnailwrap'
    });

    var $thumbnailHolder = $('<div>', {
      'class': 'h5p-clicktoreveal-thumbnailholder'
    }).appendTo($thumbnailWrapper);

    self.createThumbnailContent(card, setCardSizeCallback)
      .appendTo($thumbnailHolder);

    return $thumbnailWrapper;

  };
  
  /**
   * Create content for a thumbnail
   *
   * @param {Object} card Card parameters
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card content wrapper
   */
  C.prototype.createThumbnailContent = function (card, setCardSizeCallback) {
    var self = this;
    var $thumbnailContent = $('<div>', {
      'class': 'h5p-clicktoreveal-thumbnail-content'
    });

    self.createCardThumbnailImage(card, setCardSizeCallback)
      .appendTo($thumbnailContent);

    return $thumbnailContent;
  };

  /**
   * Creates all cards and appends them to card wrapper.
   *
   * @param {Array} cards Card parameters
   * @returns {*|jQuery|HTMLElement} Card wrapper set
   */
  C.prototype.initCards = function (cards) {
    var self = this;
    var loaded = 0;
    var initLoad = cards.length;

    self.$cardwrapperSet = $('<div>', {
      'class': 'h5p-clicktoreveal-cardwrap-set'
    });

    var setCardSizeCallback = function () {
      loaded++;
	  
	  /*If uncommented, editor does not load in Course Presentation*/
      /* if (loaded === initLoad) {
        self.resize();
      } */
    };

    for (var i = 0; i < cards.length; i++) {

      // Load cards progressively
      if (i >= initLoad) {
        break;
      }

      var $cardWrapper = self.createCard(cards[i], setCardSizeCallback);

      // Set current card
      if (i === 0) {
        $cardWrapper.addClass('h5p-clicktoreveal-current');
        self.$current = $cardWrapper;
      }

      self.addTipToCard($cardWrapper.find('.h5p-clicktoreveal-card-content'), 'front', i);

      self.$cardwrapperSet.append($cardWrapper);
    }

    return self.$cardwrapperSet;
  };

  /**
   * Create a single card
   *
   * @param {Object} card Card parameters
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card wrapper
   */
  C.prototype.createCard = function (card, setCardSizeCallback) {
    var self = this;
    var $cardWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-cardwrap'
    });

    var $cardHolder = $('<div>', {
      'class': 'h5p-clicktoreveal-cardholder'
    }).appendTo($cardWrapper);

    self.createCardContent(card, setCardSizeCallback)
      .appendTo($cardHolder);

    return $cardWrapper;

  };

  /**
   * Create content for a card
   *
   * @param {Object} card Card parameters
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card content wrapper
   */
  C.prototype.createCardContent = function (card, setCardSizeCallback) {
    var self = this;
    var $cardContent = $('<div>', {
      'class': 'h5p-clicktoreveal-card-content'
    });

    self.createCardLargeMedia(card, setCardSizeCallback)
      .appendTo($cardContent);
	 
    var $cardTextWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-card-text-wrapper'
    }).appendTo($cardContent);

    var $cardTextInner = $('<div>', {
      'class': 'h5p-clicktoreveal-card-text-inner'
    }).appendTo($cardTextWrapper);

    var $cardTextInnerContent = $('<div>', {
      'class': 'h5p-clicktoreveal-card-text-inner-content'
    }).appendTo($cardTextInner);

    self.createCardAudio(card)
      .appendTo($cardTextInnerContent);

    var $cardText = $('<div>', {
      'class': 'h5p-clicktoreveal-card-text'
    }).appendTo($cardTextInnerContent);

    $('<div>', {
      'class': 'h5p-clicktoreveal-card-text-area',
      'html': card.text
    }).appendTo($cardText);

    if (!card.text || !card.text.length) {
      $cardText.addClass('hide');
    }
	
    return $cardContent;
  };

  /**
   * Create card large media
   *
   * @param {Object} card Card parameters
   * @param {Function} [loadCallback] Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  C.prototype.createCardLargeMedia = function (card, loadCallback) {
    var self = this;
    var $mediaWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-image-wrapper'
    });
	
	if (card.media && card.media.library)
	{
      var type = card.media.library.split(' ')[0]; //Check if Media is Image or Video 
      if (type === 'H5P.Image') //If the uploaded Media is an image..
	  {
	    var $image;
        if(card.media.params.file)
		{
		  //...create <img> tag
		  if (card.media.params.file !== undefined) {
			$image = $('<img class="h5p-clicktoreveal-image" src="' + H5P.getPath(card.media.params.file.path, self.id) + '"/>');
			if (loadCallback)
				$image.load(loadCallback);
		  }
		  else {
			$image = $('<div class="h5p-clicktoreveal-image"></div>');
			if (loadCallback)
				loadCallback();
		  }
        }
		//..& append to the media wrapper <div>
		self.$images.push($image);
		$image.appendTo($mediaWrapper);
      }
      else if (type === 'H5P.Video') //If the uploaded Media is a video..
	  {
	    //..create a container within which the video will be rendered. This is needed as the 3rd parameter of H5P.newRunnable() below
		var $video = $('<div>', {
		  'class': 'h5p-clicktoreveal-video'
		});
		if(card.media.params.sources)
		{
			//Create H5P.Video instance. Borrowed from https://h5p.org/comment/6813#comment-6813
			questionObject = H5P.newRunnable(card.media, self.contentId, $video, true); //Defined in h5p/library/js/h5p.js file
			var fromVideo = false; // Hack to avoid never ending loop
			//Handle resizing
			questionObject.on('resize', function () {
				fromVideo = true;
				self.trigger('resize');
				fromVideo = false;
			});
			self.on('resize', function () {
				if (!fromVideo) {
				  questionObject.trigger('resize');
				}
			});
		}
		$video.appendTo($mediaWrapper); //..& append to the media wrapper <div>
      }
    }
    return $mediaWrapper;
  };

  /**
   * Create card thumbnail image
   *
   * @param {Object} card Card parameters
   * @param {Function} [loadCallback] Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  C.prototype.createCardThumbnailImage = function (card, loadCallback) {
    var self = this;
    var $image;
	var $imageWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-thumbnailimage-wrapper'
    });
	
    if (card.thumbnail_image !== undefined) {
      $image = $('<img class="h5p-clicktoreveal-thumbnailimage" src="' + H5P.getPath(card.thumbnail_image.path, self.id) + '"/>');
      if (loadCallback) {
        $image.load(loadCallback);
      }
    }
    else {
      $image = $('<div class="h5p-clicktoreveal-thumbnailimage"></div>');
      if (loadCallback) {
        loadCallback();
      }
    }
    self.$images.push($image);
	
	/**
	 * On clicking the thumbnail image, show its corresponding media & text using 'card' object properties
	 * Logic: Get the index of the clicked thumbnail <div> & set 'h5p-clicktoreveal-current' class of the <div> corresponding to the clicked thumbnail
	 * Also, pause the video (if any) after moving out of the frame
	 * Eg:- If the 2nd thumbnail is clicked, make the 2nd-child of <div> which forms the media wrapper as the currently being viewed card
	 */
	$image.click(function () {
	 
	  //Get index and the nth-child value
	  var clickedElemIndex = $(this).parents('.h5p-clicktoreveal-thumbnailwrap').index();
	  var nthChildIndex = clickedElemIndex + 1;
	  
	  //Find the card previously being viewed
	  var prevCard = $('.h5p-clicktoreveal-cardwrap.h5p-clicktoreveal-current');
	  
	  //Pause the video (if any) after moving out of frame
	  if(prevCard.has('video').length)
		$('.h5p-clicktoreveal-cardwrap.h5p-clicktoreveal-current video')[0].pause();
	  
	  //Remove class from it..so that it can be added to the currently being viewed card
	  prevCard.removeClass('h5p-clicktoreveal-current');
	  
	  //Add class to the currently being viewed card i.e nth-child of media wrapper where n = index of thumbnail clicked + 1
	  $('.h5p-clicktoreveal-cardwrap:nth-child('+ nthChildIndex +')').addClass('h5p-clicktoreveal-current');
    })
	  .appendTo($imageWrapper);

	return $imageWrapper;
  };
  
  /**
   * Create card audio
   *
   * @param {Object} card Card parameters
   * @returns {*|jQuery|HTMLElement} Card audio element
   */
  C.prototype.createCardAudio = function (card) {
    var self = this;
    var audio;
    var $audioWrapper = $('<div>', {
      'class': 'h5p-clicktoreveal-audio-wrapper'
    });
    if (card.audio !== undefined) {

      var audioDefaults = {
        files: card.audio
      };
      audio = new Audio(audioDefaults, self.id);
      audio.attach($audioWrapper);

      // Have to stop else audio will take up a socket pending forever in chrome.
      if (audio.audio && audio.audio.preload) {
        audio.audio.preload = 'none';
      }
    }
    else {
      $audioWrapper.addClass('hide');
    }
    self.audios.push(audio);

    return $audioWrapper;
  };

  /**
   * Change text of card, used when clicking cards.
   *
   * @param $card
   * @param text
   */
  C.prototype.changeText = function ($card, text) {
    var $cardText = $card.find('.h5p-clicktoreveal-card-text-area');
    $cardText.html(text);
    $cardText.toggleClass('hide', (!text || !text.length));
  };

  /**
   * Stop audio of card with cardindex

   * @param {Number} cardIndex Index of card
   */
  C.prototype.stopAudio = function (cardIndex) {
    var self = this;
    var audio = self.audios[cardIndex];
    if (audio && audio.stop) {
      audio.stop();
    }
  };

  /**
   * Hide audio button
   *
   * @param $card
   */
  C.prototype.removeAudio = function ($card) {
    var self = this;
    self.stopAudio($card.closest('.h5p-clicktoreveal-cardwrap').index());
    $card.find('.h5p-audio-inner')
      .addClass('hide');
  };

  /**
   * Show all audio buttons
   */
  C.prototype.showAllAudio = function () {
    var self = this;
    self.$cardwrapperSet.find('.h5p-audio-inner')
      .removeClass('hide');
  };

  /**
   * Reset the task so that the user can do it again.
   */
  C.prototype.reset = function () {
    var self = this;
    var $cards = self.$inner.find('.h5p-clicktoreveal-cardwrap');

    self.stopAudio(self.$current.index());
    self.$current.removeClass('h5p-clicktoreveal-current');
    self.$current = $cards.filter(':first').addClass('h5p-clicktoreveal-current');
    self.updateNavigation();

    $cards.each(function (index) {
      var $card = $(this).removeClass('h5p-clicktoreveal-previous');
      self.changeText($card, self.params.cards[$card.index()].text);

      self.addTipToCard($card.find('.h5p-clicktoreveal-card-content'), 'front', index);
    });
    self.$retry.addClass('h5p-clicktoreveal-disabled');
    self.showAllAudio();
    self.resizeOverflowingText();
  };

  /**
   * Update the dimensions of the task when resizing the task.
   */
  C.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;
    self.updateImageSize();
    
    // Reset card-wrapper-set height
    self.$cardwrapperSet.css('height', 'auto');

    //Find max required height for all cards
    self.$cardwrapperSet.children().each( function () {
      var wrapperHeight = $(this).css('height', 'initial').outerHeight();
      $(this).css('height', 'inherit');
      maxHeight = wrapperHeight > maxHeight ? wrapperHeight : maxHeight;

      // Check height
      if (!$(this).next('.h5p-clicktoreveal-cardwrap').length) {
        var initialHeight = $(this).find('.h5p-clicktoreveal-cardholder').css('height', 'initial').outerHeight();
        maxHeight = initialHeight > maxHeight ? initialHeight : maxHeight;
        $(this).find('.h5p-clicktoreveal-cardholder').css('height', 'inherit');
      }
    });
    var relativeMaxHeight = maxHeight / parseFloat(self.$cardwrapperSet.css('font-size'));
    self.$cardwrapperSet.css('height', relativeMaxHeight + 'em');
    self.scaleToFitHeight();
    self.truncateRetryButton();
    self.resizeOverflowingText();
  };

  C.prototype.scaleToFitHeight = function () {
    var self = this;
    if (!self.$cardwrapperSet || !self.$cardwrapperSet.is(':visible')) {
      return;
    }
    // Resize font size to fit inside CP
    if (self.$inner.parents('.h5p-course-presentation').length) {
      var $parentContainer = self.$inner.parent();
      if (self.$inner.parents('.h5p-popup-container').length) {
        $parentContainer = self.$inner.parents('.h5p-popup-container');
      }
      var containerHeight = $parentContainer.get(0).getBoundingClientRect().height;
      var getContentHeight = function () {
        var contentHeight = 0;
        self.$inner.children().each(function () {
          contentHeight += $(this).get(0).getBoundingClientRect().height +
          parseFloat($(this).css('margin-top')) + parseFloat($(this).css('margin-bottom'));
        });
        return contentHeight;
      };
      var contentHeight = getContentHeight();
      var parentFontSize = parseFloat(self.$inner.parent().css('font-size'));
      var newFontSize = parseFloat(self.$inner.css('font-size'));

      // Decrease font size
      if (containerHeight < contentHeight) {
        while (containerHeight < contentHeight) {
          newFontSize -= C.SCALEINTERVAL;

          // Cap at min font size
          if (newFontSize < C.MINSCALE) {
            break;
          }

          // Set relative font size to scale with full screen.
          self.$inner.css('font-size', (newFontSize / parentFontSize) + 'em');
          contentHeight = getContentHeight();
        }
      }
      else { // Increase font size
        var increaseFontSize = true;
        while (increaseFontSize) {
          newFontSize += C.SCALEINTERVAL;

          // Cap max font size
          if (newFontSize > C.MAXSCALE) {
            increaseFontSize = false;
            break;
          }

          // Set relative font size to scale with full screen.
          var relativeFontSize = newFontSize / parentFontSize;
          self.$inner.css('font-size', relativeFontSize + 'em');
          contentHeight = getContentHeight();
          if (containerHeight <= contentHeight) {
            increaseFontSize = false;
            relativeFontSize = (newFontSize - C.SCALEINTERVAL) / parentFontSize;
            self.$inner.css('font-size', relativeFontSize + 'em');
          }
        }
      }
    }
    else { // Resize mobile view
      self.resizeOverflowingText();
    }
  };

  /**
   * Resize the font-size of text areas that tend to overflow when dialog cards
   * is squeezed into a tiny container.
   */
  C.prototype.resizeOverflowingText = function () {
    var self = this;

    // Resize card text if needed
    var $textContainer = self.$current.find('.h5p-clicktoreveal-card-text');
    var $text = $textContainer.children();
    self.resizeTextToFitContainer($textContainer, $text);
  };

  /**
   * Increase or decrease font size so text wil fit inside container.
   *
   * @param {jQuery} $textContainer Outer container, must have a set size.
   * @param {jQuery} $text Inner text container
   */
  C.prototype.resizeTextToFitContainer = function ($textContainer, $text) {
    var self = this;

    // Reset text size
    $text.css('font-size', '');

    // Measure container and text height
    var currentTextContainerHeight = $textContainer.get(0).getBoundingClientRect().height;
    var currentTextHeight = $text.get(0).getBoundingClientRect().height;
    var parentFontSize = parseFloat($textContainer.css('font-size'));
    var fontSize = parseFloat($text.css('font-size'));
    var mainFontSize = parseFloat(self.$inner.css('font-size'));

    // Decrease font size
    if (currentTextHeight > currentTextContainerHeight) {
      var decreaseFontSize = true;
      while (decreaseFontSize) {

        fontSize -= C.SCALEINTERVAL;

        if (fontSize < C.MINSCALE) {
          decreaseFontSize = false;
          break;
        }

        $text.css('font-size', (fontSize / parentFontSize) + 'em');

        currentTextHeight = $text.get(0).getBoundingClientRect().height;
        if (currentTextHeight <= currentTextContainerHeight) {
          decreaseFontSize = false;
        }
      }

    }
    else { // Increase font size
      var increaseFontSize = true;
      while (increaseFontSize) {
        fontSize += C.SCALEINTERVAL;

        // Cap at  16px
        if (fontSize > mainFontSize) {
          increaseFontSize = false;
          break;
        }

        // Set relative font size to scale with full screen.
        $text.css('font-size', fontSize / parentFontSize + 'em');
        currentTextHeight = $text.get(0).getBoundingClientRect().height;
        if (currentTextHeight >= currentTextContainerHeight) {
          increaseFontSize = false;
          fontSize = fontSize- C.SCALEINTERVAL;
          $text.css('font-size', fontSize / parentFontSize + 'em');
        }
      }
    }
  };

  /**
   * Truncate retry button if width is small.
   */
  C.prototype.truncateRetryButton = function () {
    var self = this;
    if (!self.$retry) {
      return;
    }

    // Reset button to full size
    self.$retry.removeClass('truncated');
    self.$retry.html(self.params.retry);

    // Measure button
    var maxWidthPercentages = 0.3;
    var retryWidth = self.$retry.get(0).getBoundingClientRect().width +
        parseFloat(self.$retry.css('margin-left')) + parseFloat(self.$retry.css('margin-right'));
    var retryWidthPercentage = retryWidth / self.$retry.parent().get(0).getBoundingClientRect().width;

    // Truncate button
    if (retryWidthPercentage > maxWidthPercentages) {
      self.$retry.addClass('truncated');
      self.$retry.html('');
    }
  };

  C.SCALEINTERVAL = 0.2;
  C.MAXSCALE = 16;
  C.MINSCALE = 4;

  return C;
})(H5P.jQuery, H5P.Audio, H5P.JoubelUI);