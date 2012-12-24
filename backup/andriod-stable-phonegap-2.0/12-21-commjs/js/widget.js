/* File Created: Ê®ÔÂ 19, 2012 */
(function ($) {
	$.widget("news.popmsg", {
		options : {
			page : {},
			to : {}
			
		},
		_create : function () {
			var options = {
				theme : "e",
				key : "pop_height_key"
			};
			
			this.options = $.extend(true, options, this.options);
			/*in this scenario our pop closes itself automatically,
			so we set the history to false to disable the back ability
			and let it doesn't update the url hash,otherwise,the function can't work
			and page changing behavior is misleading*/
			this.element.popup({
				theme : this.options.theme,
				history : false
			});
		},
		_init : function () {},
		show : function (msg) {
			this.element.html("<p>" + msg + "</p>");
			//caculate the top of pop must be after insert content to it
			var $this = this,
			poptop = $(this.options.to).position().top - this.element.height();
			
			this.element.popup("open", {
				y : poptop
			});
			setTimeout(function () {
				$this.element.popup("close");
				
			}, 500);
		},
		_destroy : function () {
			this.element.jqmRemoveData();
			$.Widget.prototype.destroy.call(this);
		}
	});
	
	$.widget("news.datagrid", {
		options : {},
		_create : function () {
			var options = {
				url : "",
				type : "GET",
				data : {},
				dataType : "json",
				linkUrl : "detail.html",
				success : function () {},
				error : function () {}
			};
			
			this.options = $.extend(true, options, this.options);
		},
		_init : function () {},
		_update : function () {},
		_destory : function () {
			$.Widget.prototype.destroy.call(this);
		},
		_getData : function () {
			$.mobile.loading("show");
			var $this = this;
			$.ajax({
				url : this.options.url,
				type : this.options.type,
				data : this.options.data,
				dataType : this.options.dataType,
				success : function (data) {
					data && data.jsonp && data.jsonp.data && data.jsonp.data.status === 1 ?
					(function () {
						var newsList = data.jsonp.data.data.newsList;
						if (newsList) {
							var list = $this.element;
							list.empty();
							
							for (var index in newsList) {
								var newItem = newsList[index],
								key = "item_i" + index;
								
								newItem.image.path = newItem.image.path ? "http://61.129.42.58:9080" + newItem.image.path : "css/images/defaultnew.gif";
								var item = $("<li><a><img src='" + newItem.image.path + "' /><h6>" + newItem.titleNews + "</h6><p>" + newItem.time + "</p></a></li>");
								item.click(function () {
									$.mobile.changePage($this.options.linkUrl);
								});
								
								$(item).attr("id", key)
								.data(key, newItem)
								.click(function () {
									list.data("current_item", $(this).jqmData(this.id));
								});
								list.append(item);
							}
							$this.element.listview("refresh");
							
							$.mobile.loading("hide");
							
							$this.options.success();
						}
					})() :
					$this.options.error();
				}
			});
		},
		refresh : function () {
			this._getData();
		}
	});
	
	$.widget("news.shell", {
		options : {},
		_create : function () {
			var doptions = {
				title : "Home",
				navs : [{
						icon : "grid",
						title : "Top news",
						isActive : true
					}, {
						icon : "grid",
						title : "Hot news"
					}, {
						icon : "grid",
						title : "University news"
					}, {
						icon : "grid",
						title : "Collage news"
					}, ]
			};
			
			this.options = $.extend(true, doptions, this.options);
			
			this.element.append(this._header())
			.append(this._frame())
			.append(this._footer());
		},
		_init : function () {},
		_destory : function () {
			$.Widget.prototype.destroy.call(this);
		},
		_header : function () {
			return $("<div id='shell_header' data-role='header' data-title='" + this.options.title + "'><h1>" + this.options.title + "</h1></div>")
			.css({
				"height" : "42px",
				"position" : "absolute",
				"width" : "100%",
				"z-index" : "2"
			});
		},
		_footer : function () {
			var html = "<div id='shell_footer' data-role='footer'></div>";
			return $(html).css({
				"height" : "57px",
				"position" : "absolute",
				"width" : "100%",
				"bottom" : "0",
				"z-index" : "2"
			})
			.append(this._nav());
		},
		_nav : function () {
			var html = "<div data-role='navbar'><ul>";
			for (i in this.options.navs) {
				var nav = this.options.navs[i],
				icon = nav.icon || "grid";
				
				html += "<li><a id='shell_nav" + i + "' data-icon='" + icon + "'";
				if (nav.isActive)
					html += " class='ui-btn-active'";
				html += ">" + nav.title + "</a></li>";
			}
			html += "</ul></div>";
			return $(html);
		},
		_frame : function () {
			var frame = $("<div id='shell_content' data-role='content'></div>"),
			scroller = $("<div id='shell_scroller'></div>");
			
			frame.css({
				"top" : "42px",
				"bottom" : "57px",
				"padding" : "0",
				"position" : "absolute",
				"width" : "100%",
				"overflow" : "auto"
			});
			scroller.css({
				"position" : "absolute",
				"-webkit-tap-highlight-color" : "rgba(0,0,0,0)",
				"width" : "100%",
				"padding" : "0"
			});
			scroller.append(this._screen);
			return frame.append(scroller);
		},
		_screen : function () {
			return $("<div id='shell_contentpage' data-role='page'>" +
				"<div id='shell_screen' data-role='content'>" +
				"<p>loading...</p></div></div>");
		},
		
	});
	
})(jQuery);

(function ($) {
	
	$("#list1_newsPage").live("pagebeforecreate", function (event) {
		
		//var popmsg = $("#list1_pop_msg").popmsg({ page: "#list1_newsPage", to: "#list1_content" });
		var grid = $("#list1_news").datagrid({
				url : "http://61.129.42.58:9080/sid/newsService/vid/index",
				type : "POST",
				data : {
					codeType : "01"
				},
				linkUrl : "detail1.html",
				dataType : "jsonp"
			});
		
		grid.datagrid("refresh");
		
	});
	
})(jQuery)