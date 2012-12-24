	$(document).bind("mobileinit", function () {
		$.mobile.defaultPageTransition = "slide";
		$.mobile.page.prototype.options.addBackBtn = true;
		$.mobile.loadingMessageTextVisible = true;
		$.mobile.phonegapNavigationEnabled = true;
		//$.mobile.hashListeningEnabled = false;
		//$.mobile.pushStateEnabled = false

		$.mobile.getScreenHeight = function () {
			var total = window.innerHeight || $( window ).height();

			return (total - 42 - 42) ;
		}
		createWidgets(jQuery);
		loadBizs();
	});


(function ($, wind, doc) {
	var shell = function (options) {
		var o = {
			title : "Home",
			activeNav : -1
		};
		
		this.options = $.extend(true, o, options);

		var body = $(doc.body);
		this._originalHtml = body.html();
		body.empty();
		this._create();
	};
	
	shell.prototype = {
		options : {},
		_header : function () {
			return $("<div id='shell_header' class='cs-header' data-role='header' data-title='" + this.options.title + "'><h1>" + this.options.title + "</h1></div>");
		},
		_footer : function () {
			var html = "<div id='shell_footer' class='cs-footer' data-role='footer'></div>";
			return $(html);
		},
		_navs : {},
		_navListeners : [],
		_create : function () {
			var pageHtml = "<div id='shell_page' data-role='page'></div>",
				origin = $(this._originalHtml);

			this.firstPage = origin.find("div:jqmData(role='page')");
			
			$(doc.body).append(pageHtml);
			$("#shell_page").append(this._header())
			.append("<div id='shell_content' data-role='content' class='cs-content'></div>");

			$("#shell_content").append(origin);
			$("#shell_page").append(this._footer());

			$this = this;
			
			$("#shell_page").live("pagebeforecreate", function (e) {

				var scroller = $(e.target).find('.cs-scroller');
				if(scroller.length){
					scroller.css('min-height',$this.getContentHeight());
				}

				/*because the nested page (child page) also fires this event ,
				so we need to make sure only when the home page fires this event,then execute*/
				if (e.target.id !== "shell_page")
					return;
				
				//change the global page container
				$.mobile.pageContainer = $('#shell_content');
				//add the page classes onto the nested screen page
				$this.firstPage.addClass("ui-page ui-body-c ui-page-active");
				//set the first page of jquery mobile to first page of shell
				$.mobile.firstPage = $this.firstPage;
				//load the screen page into the content
				$.mobile.loadPage('#'+$this.firstPage.attr('id'));
				
				/* the update url logic
				var url = $.mobile.path.parseLocation(),
				hash = "#" + url.directory + "shell_screen_page",
				hUrl = url.protocol + "//" + url.host + url.pathname + url.search + hash,
				state = {
				// firefox auto decodes the url when using location.hash but not href
				hash : hash,
				title : doc.title,
				// persist across refresh
				initialHref : hUrl
				};*/
				
				//because jquery uses our shell_page as first page and
				//set shell_page url to history,so we should update the url
				//with our nested shell_screen_page to history.
				history.replaceState({
					hash : '#'+$this.firstPage.attr('id'),
					title : "Home",
					initialHref : ""
				});
				
			});	

			$(doc).live('pageshow',function (e) {
				if(e.target.id === 'shell_page'){
					$.mobile.activePage = $this.firstPage;
					return;
				}

				$('#'+e.target.id).css('min-height',$this.getContentHeight());
			})

			// $(doc).live('pagebeforehide',function (e) {
			// 	if(e.target.id === 'shell_page'){
			// 		return;
			// 	}

			// 	$(e.target.id).find('.cs-wrapper').css('display','none');

			// });

		},
		_data : {},
		firstPage:{},
		_destroy : function () {
			var leg = this._navListeners.length;
			if (leg)
				this._navListeners.splice(0, leg);
		},
		_getNav : function (index) {
			var keys = Object.keys(this._navs);
			if (keys && keys.length && (index < keys.length))
				return this._navs[keys[index]];
			return null;
		},
		getContentHeight:function () {
			var total = window.innerHeight || $( window ).height();

			return total - 42 - 42 ;
		},
		set : function (key, value) {
			this.options[key] = value;
		},
		onNav : function (fn) {
			this._navListeners.push(fn);
		},
		unNav : function (fn) {
			if (!fn || !this._navListeners.length)
				return;
			
			for (var i in this._navListeners) {
				var _fn = this._navListeners[i];
				if (fn === _fn)
					this._navListeners.splice(i, 1);
			}
		},
		data : function (key) {
			var obj = Array.prototype.slice.apply(arguments);
			if (!key || obj.length < 1)
				return null;
			if (obj.length == 1)
				return this._data[key];
			else {
				this._data[key] = obj[1];
			}
		},
		removeData : function (key) {
			delete this._data[key];
		},
		curNav : {},
		addNavs : function (navs) {
			var bar = $("#shell_navbar"),
			ul = $("#shell_navs");
			
			var isHasNavbar = true;
			var $this = this;
			
			if (!bar.length) {
				isHasNavbar = false;
				
				bar = $("<div id='shell_navbar' data-role='navbar'></div>");
				ul = $("<ul id='shell_navs'></ul>");
			}
			
			$this = this;
			for (i in navs) {
				var nav = navs[i],
				icon = nav.icon || "grid";
				
				var li = $("<li></li>");
				var a = $("<a id='shell_nav" + nav.id + "' data-icon='" + icon + "'>" + nav.title + "</a>");
				a.jqmData("nav", nav);
				
				if (i == this.options.activeNav)
					a.addClass("ui-btn-active");
				
				a.click(function () {
					
					//if the activepage is shell_page means that it is first load
					var fromPage = ($.mobile.activePage.length &&
						$.mobile.activePage.attr("id") !== "shell_page")
					 ? $.mobile.activePage : $this.firstPage;
					
					var cNav = $(this).jqmData("nav");
					path = $.mobile.path.parseUrl(fromPage.attr("data-url"));
					//if not the same page navigating
					if (path.filename != cNav.url) {
						$.mobile.changePage(nav.url, {
							fromPage : fromPage,
							data : cNav.data
						});
					} else {
						var length = $.fm.shell._navListeners.length;
						if (length)
							for (var i = 0; i < length; i++) {
								$.fm.shell._navListeners[i](cNav);
							}
					}
					
					$.fm.shell.curNav = cNav;
					$.fm.shell.setTitle(cNav.title);
				});
				
				li.append(a);
				ul.append(li);
				
				$this._navs[nav.id] = nav;
				
			}
			if (!isHasNavbar) {
				bar.append(ul);
				$("#shell_footer").append(bar);
				bar.navbar();
			}
		},
		hideNavs : function (opts) {
			if (!opts) {
				for (var n in this._navs) {
					$("#shell_nav" + n).css("display", "none");
				}
			} else {
				for (var n in opts) {
					$("#shell_nav" + id).css("display", "none");
				}
			}
		},
		showNavs : function (opts) {
			if (!opts) {
				for (var n in this._navs) {
					$("#shell_nav" + n).css("display", "block");
				}
			} else {
				for (var n in opts) {
					$("#shell_nav" + id).css("display", "block");
				}
			}
		},
		hasNav : function () {
			var name;
			for (name in this._navs) {
				return true;
			}
			return false;
		},
		activeNav : function (q, exc) {
			if (this.hasNav) {
				$("#shell_nav" + this.curNav.id).removeClass("ui-btn-active");
			}
			var navdom;
			//if the q is string then use it as id else as index
			if (typeof q === "String") {
				navdom = $("#shell_nav" + q);
			} else {
				var nav = this._getNav(q);
				this.curNav = nav;
				navdom = $("#shell_nav" + nav.id);
			}
			
			navdom.addClass("ui-btn-active");
			if (exc)
				navdom.trigger("click");
		},
		showLoading : function (opt) {
			$.mobile.pageContainer = $("#shell_page");
			$.mobile.loading("show", opt);
			$.mobile.pageContainer = $("#shell_content");
		},
		hideLoading : function () {
			$.mobile.loading("hide");
		},
		setTitle : function (title) {
			var header = $("#shell_header");
			if (header.length)
				header.find("h1").text(title);
		}
	};
	
	$.fm = {};
/*	$.fm = $.extend({}, {
			shell : new shell({
				activeNav : -1,
				navs : [{
						id : "topNews",
						title : "Top news",
						icon : "grid",
						url : "list.html",
						data : {
							codeType : "01"
						}
					}, {
						id : "hotNews",
						title : "Hot news",
						icon : "grid",
						url : "list.html",
						data : {
							codeType : "02"
						}
					}, {
						id : "universityNews",
						title : "University news",
						icon : "grid",
						url : "list.html",
						data : {
							codeType : "03"
						}
						
					}, {
						id : "collageNews",
						title : "Collage news",
						icon : "grid",
						url : "list.html",
						data : {
							codeType : "04"
						}
					}
				],
				activeNav : 0
			})
		});*/
	
	$(function () {
		$.fm.shell = new shell();
	});
	
})(jQuery, this, document);

(function ($, wind, doc) {
	$.fm.utility = {
		getObjInfo : function (obj) {
			var keys = Object.keys(obj);
			var len = keys.length;
			
			var getKey = function (i) {
				if (i > len - 1)
					return null;
				return keys[i];
			};
			
			var getValue = function (i) {
				if (typeof i === "string") {
					return obj[i];
				}
				
				if (i > len - 1)
					return null;
				
				return obj[keys[i]];
			};
			
			var setValue = function (i, value) {
				if (typeof i === "string") {
					obj[i] = value;
					return;
				}
				
				if (i > len - 1)
					return;
				
				obj[keys[i]] = value;
			};
			
			return {
				length : len,
				getKey : getKey,
				getValue : getValue,
				setValue : setValue
			};
		}
	};
	
})(jQuery, window, document);

(function ($, wind, doc) {
	var database = function (db, options) {
		var opt = {
			version : "1.0",
			name : db,
			size : 104857600,
			isDebug : false
		};
		this.options = $.extend(true, opt, options);
		
		this.db = wind.openDatabase(db,
				this.options.version,
				this.options.name,
				this.options.size);
		
		if (this.options.isDebug)
			alert("database: " + db + ":" + this.options.version + ":" + this.options.name + ":" + this.options.size);
	};
	
	database.prototype = {
		_errHandler : function (func, sql, err) {
			var msg = "code: " + err.code + " msg: " + err.message;
			if (this.options.isDebug) {
				alert("executing sql " + sql + " of " + func + " on database " + this.options.name + " error:" + msg);
			}
			console.log(msg);
		},
		_exec : function (func, sql, onComplete) {
			var $this = this;
			
			this.db.transaction(function (tx) {
				tx.executeSql(sql, [],
					function (tx, results) {
					
					if (!onComplete)
						return;
					
					var data = [];
					
					var raf = results.rowsAffected;
					if($this.options.isDebug){
						alert("sql: " + sql + "\n rowsAffected: " + raf + "\n insertId: "
						+results.insertId + "\n row: " + results.rows.length);
					}
					//if the sql is not query then return the rows affected
					//else return the queried data array
					if (raf) {
						data.push(raf);
						onComplete(data);
					} else {
						var len = results.rows.length;
						for (var i = 0; i < len; i++) {
							var d = results.rows.item(i),
							m = $.fm.utility.getObjInfo(d),
							mlen = m.length;
							
							for (var j = 0; j < mlen; j++) {
								m.setValue(j, JSON.parse(unescape(m.getValue(j))));
							}
							
							data.push(d);
						}
						onComplete(data);
					}
				}, function (err) {
					$this._errHandler("executeSql error: " + func, sql, err);
				});
			},
				function (err) {
				$this._errHandler("transaction error: " + func, sql, err);
			});
			
		},
		_verifydb : function () {
			if (!this.db) {
				this._errHandler(null, null, "the database is null");
				
				return false;
			}
			
			return true;
		},
		_filter : function (filter) {
			var sql = ' WHERE ';
			if (filter) {
				var mtx = $.fm.utility.getObjInfo(filter);
				
				for (var i = 0; i < mtx.length; i++) {
					if (i > 0)
						sql += ' AND ';
					var key = mtx.getKey(i);
					sql += key + ' = "' + escape(JSON.stringify(mtx.getValue(key))) + '"';
				}
			}
			return sql;
		},
		_insert : function (tb, keys, data) {
			var sql = '',
			fsql = '',
			vsql = '';
			
			if (!keys)
				keys = Object.keys(data);
			
			for (var k in keys) {
				var key = keys[k];
				fsql += ' ' + key + ',';
				vsql += '"' + escape(JSON.stringify(data[key])) + '",';
			}
			fsql = fsql.substring(0, fsql.lastIndexOf(','));
			vsql = vsql.substring(0, vsql.lastIndexOf(','));
			sql += 'INSERT INTO ' + tb + ' ( ' + fsql;
			
			sql += ') VALUES (' + vsql + ')';
			
			return sql;
		},
		_update : function (tb, primary, filter, keys, data) {
			var sql = '';
			if (!keys)
				keys = Object.keys(data);
			
			sql += 'UPDATE ' + tb + ' SET ';
			for (var k in keys) {
				var key = keys[k];
				if (key === primary)
					continue;
				
				sql += ' ' + key + ' = "' + escape(JSON.stringify(data[key])) + '",';
			}
			sql = sql.substring(0, sql.lastIndexOf(','));
			
			sql += this._filter(filter);
			return sql;
		},
		createtb : function (tb, options) {
			if (!this._verifydb()) {
				return;
			}
			
			if (!options.primary)
				return;
			
			var sql = 'CREATE TABLE IF NOT EXISTS ' + tb + '(';
			var len = options.fields.length;
			
			for (var i = 0; i < len; i++) {
				var f = options.fields[i];
				if (options.primary === f) {
					sql += f + ' unique,';
				} else
					sql += f + ',';
			}
			sql = sql.substring(0, sql.lastIndexOf(','));
			sql += ')';
			
			this._exec("createtb", sql, options.onComplete);
		},
		droptb : function (tb) {
			if (!this._verifydb())
				return;
			
			var sql = 'DROP TABLE IF EXISTS ' + tb;
			this._exec("droptb", sql);
			
		},
		has : function (tb, options) {
			var sql = 'SELECT COUNT(1) as count FROM ' + tb + this._filter(options.filter);
			
			this._exec("has", sql, function (r) {
				options.onComplete(parseInt(r[0].count));
			});
		},
		//data:[{id:{codetype:01},data:{id:01}}},{id:{codetype:02},data:{id:02}}]
		add : function (tb, options) {
			if (!this._verifydb()) {
				return;
			}
			var primary = options.primary,
			data = options.data;
			
			if (!data || !data.length)
				return;
			
			var obj = data[0],
			keys = Object.keys(obj),
			$this = this;
			
			this.createtb(tb, {
				primary : primary,
				fields : keys,
				onComplete : function () {
					for (var i in data) {
						var d = data[i],
						pValue = d[primary],
						filter = {};
						
						filter[primary] = pValue;
						
						var exe = function (tb, primary, filter, keys, rd) {
							$this.has(tb, {
								filter : filter,
								onComplete : function (exists) {
									var sql = "";
									//if the key of data already have ,then update it,else insert it
									if (exists) {
										sql = $this._update(tb, primary, filter, keys, rd);
									} else {
										sql = $this._insert(tb, keys, rd);
									}
									$this._exec("add", sql);
								}
							});
						};
						
						exe(tb, primary, filter, keys, d);
						
					}
				}
			});
		},
		query : function (tb, options) {
			if (!this._verifydb()) {
				return;
			}
			var fields = options.fields,
			filter = options.filter,
			onComplete = options.onComplete;
			
			var sql = 'SELECT ';
			if (fields.length) {
				// for (var f in fields) {
				// 	sql += fields[f] + ',';
				// }
				// sql = sql.substring(0, sql.lastIndexOf(','));
				sql += fields.join(',');
			} else {
				sql += "*";
			}
			sql += ' FROM ' + tb;
			
			sql += this._filter(filter);
			
			this._exec("query", sql, onComplete);
		},
		del : function (tb, options) {
			if (!this._verifydb()) {
				return;
			}
			
			var sql = 'DELETE FROM ' + tb;
			sql += this._filter(options.filter);
			
			this._exec("del", sql, options.onComplete);
		}
	};
	
	doc.addEventListener("deviceready", function () {
		$.fm.db = {
			getdb : function (db, options) {
				return new database(db, options);
			}
		};
	}, false);
	
	// $.fm.db = {
	// 	getdb : function (db, options) {
	// 		return new database(db, options);
	// 	}
	// };
	
})(jQuery, this, document);

//create all widgets
function createWidgets($) {
	
	$.widget("news.datagrid", {
		options : {},
		_create : function () {
			var options = {
				url : "",
				type : "GET",
				data : {},
				dataType : "json",
				linkUrl : "detail.html"
			};
			
			this.options = $.extend(true, options, this.options);
		},
		_init : function () {},
		_update : function () {},
		_destory : function () {
			$.Widget.prototype.destroy.call(this);
		},
		_render : function (data,options) {
			var $this = this;
			if (data.length) {
				var grid = this.element;
				grid.empty();
				
				for (var index in data) {
					var newItem = data[index],
					key = "item_" + index;
					
					if(!options.fromCahce)
						newItem.image.path = newItem.image.path ? "http://61.129.42.58:9080" + newItem.image.path : "css/images/defaultnew.gif";

					var item = $("<li><a href='" + this.options.linkUrl + "'><img style='margin:0.6em 0' src='" + newItem.image.path + "' /><h6>" + newItem.titleNews + "</h6><p>" + newItem.time + "</p></a></li>");
					
					$(item).attr("id", key)
					.data(key, newItem)
					.click(function () {
						grid.data("current_item", {
							id : this.id,
							data : $(this).jqmData(this.id)
						});
						
						if($this.options.itemClick)
							$this.options.itemClick(this.id);
					});
					grid.append(item);
				}
				
				this.element.listview("refresh");
			}
		},
		_getDataServer : function () {
			var $this = this;
			$.ajax({
				url : this.options.url,
				type : this.options.type,
				data : this.options.data,
				dataType : this.options.dataType,
				success : function (data) {
					if (data && data.jsonp && data.jsonp.data && data.jsonp.data.status === 1) {
						var news = data.jsonp.data.data.newsList;
						//alert("render data from server");
						$this._render(news,{fromCahce:false});
						if($.fm.db){
							var db = $.fm.db.getdb("news",{isDebug:false});
							db.add("NEWS", {
								primary : "id",
								data : [{
										id : $this.options.data,
										data : news
									}
								],
								onComplete : function (ar) {
									if (ar.length) {
										alert("add the " + ar[0] + "data");
									}
								}
							});
						}
						
						$.fm.shell.hideLoading();
						if ($this.options.success)
							$this.options.success();
					} else {
						if ($this.options.error)
							$this.options.error();
					}
				}
			});
		},
		_getData : function () {
			$.fm.shell.showLoading();
			var $this = this;
			
			if (this.options.caching && $.fm.db && $.fm.isFirstLoad) {
				var db = $.fm.db.getdb("news",{isDebug:false});
				
				db.createtb("NEWS",{primary:"id",fields:["id","data"]});
				db.query("NEWS", {
					filter:{id : this.options.data},
					fields : ["data"],
					onComplete : function (data) {
						if (data.length) {
							$this._render(data[0].data,{fromCahce:true});
							
							$.fm.shell.hideLoading();
							if ($this.options.success)
								$this.options.success();
						} else {
							$this._getDataServer();
						}
					}
				});
			} else {
				$this._getDataServer();
			}

			$.fm.isFirstLoad = false;
			
		},
		refresh : function () {
			this._getData();
		}
		
	});
};


function loadBizs () {

	(function news_page() {
		var self = {
            this:this
        };
        //refresh the datagrid
        var refNews = function (nav) {
            var grid = $("#news_ul").data("datagrid");
            if (grid) {
                grid.option({
                    data : {
                        codeType : nav.data.codeType
                    },
                    caching:false
                });
                grid.refresh();
                
                self.scroller.refresh();
            }
        };

        $.fm.isFirstLoad = false;
        
        $("#news_page").live("pagebeforecreate", function (event) {
            this.title = $.fm.shell.curNav.title;
            var nav = $.fm.shell.curNav,
            codeType = nav.data && nav.data.codeType || "01",
            grid = $("#news_ul").datagrid({
                    url : "http://61.129.42.58:9080/sid/newsService/vid/index",
                    type : "POST",
                    data : {
                        codeType : codeType
                    },
                    caching:true,
                    linkUrl : "detail.html",
                    dataType : "jsonp",
                    itemClick : function (id) {
                        $.fm.shell.data("news_slt_item", $("#" + id).offset());
                    },
                    success:function(){
                        self.scroller = new iScroll('news_scroller');
                    }
                });
            grid.datagrid("refresh");
            
            //listen to the navigation event from shell
            $.fm.shell.onNav(refNews);
        });
        
        
        //when the news page has been removed ,remove the event listeners
        $("#news_page").live("pageremove", function (event) {
            $.fm.shell.unNav(refNews);
        });

	})();

	(function detail_page () {
		 $("#detail_page").live("pagebeforecreate", function (event) {
            var current = $("#news_ul").jqmData("current_item");
            
            if (!current)
                return;
            
            //$.fm.shell.data("current_item", current);
            event.target.title = current.data.titleNews;
            
            var author = current.data.author || "",
            time = current.time || "";
            var html = "<h2>" + current.data.titleNews + "</h2>" +
                "<h6>作者：" + author + " 时间: " + time + "</h6>" +
                "<span id='new_image' style='float:right'><img alt='' src='" + current.data.image.path + "' /></span>" +
                "<p>" + current.data.descNews + "</p>";
            var content = $("#detail_content").html(html);
            
        });
	})();
}

