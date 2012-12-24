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
			
			$.fm.utility.log("executing sql " + sql + " of " + func + " on database " + this.options.name + " error:" + msg);
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
					if ($this.options.isDebug) {
						alert("sql: " + sql + "\n rowsAffected: " + raf + "\n insertId: " +
							results.insertId + "\n row: " + results.rows.length);
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
				var v = parseInt(r[0].count);
				options.onComplete(v);
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
		console.log('deviceready');
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

$(document).bind("mobileinit", function () {
	$.mobile.defaultPageTransition = "slide";
	$.mobile.page.prototype.options.addBackBtn = true;
	$.mobile.loadingMessageTextVisible = true;

	//enable phonegap features
	$.mobile.phonegapNavigationEnabled = true;
	//$.mobile.pushStateEnabled = false;
	//in phonegap apps,these two features must be set to true
	$.support.cors = true;
	$.mobile.allowCrossDomainPages = true;

	//custom features
	$.mobile.transitionHandlers["slide"] = slideTransition;
	$.mobile.defaultTransitionHandler = slideTransition;
	
	//load the buisness logic
	createWidgets(jQuery, window, document);
	loadBizs(jQuery, window, document);
});

function slideTransition(name,reverse,$to,$from){
			var deferred = new $.Deferred(),
			reverseClass = reverse ? " reverse" : "",
			active	= $.mobile.urlHistory.getActive(),
			toScroll = active.lastScroll || $.mobile.defaultHomeScroll,
			screenHeight = $.mobile.getScreenHeight(),
			maxTransitionOverride = $.mobile.maxTransitionWidth !== false && $( window ).width() > $.mobile.maxTransitionWidth,
			none = !$.support.cssTransitions || maxTransitionOverride || !name || name === "none" || Math.max( $( window ).scrollTop(), toScroll ) > $.mobile.getMaxScrollForTransition(),
			toPreClass = " ui-page-pre-in",
			translateOpen ='',
			translateClose='',
			toggleViewportClass = function() {
				$.mobile.pageContainer.toggleClass( "ui-mobile-viewport-transitioning viewport-" + name );
			},
			scrollPage = function() {
				// By using scrollTo instead of silentScroll, we can keep things better in order
				// Just to be precautios, disable scrollstart listening like silentScroll would
				$.event.special.scrollstart.enabled = false;

				window.scrollTo( 0, toScroll );

				// reenable scrollstart listening like silentScroll would
				setTimeout( function() {
					$.event.special.scrollstart.enabled = true;
				}, 150 );
			},
			transitionComplete = function (el,complete) {
				el.one('webkitTransitionEnd',function (e) {
					//e.preventDefault();
					if(complete) complete();
				});
			},
			startOut = function() {
				// Set the from page's height and start it transitioning out
				// Note: setting an explicit height helps eliminate tiling in the transitions
				$from.height( screenHeight + $( window ).scrollTop() );

				//$from.css('-webkit-transform','translate'+translateOpen+'0%,0%'+translateClose);

				$from.css('-webkit-transition','-webkit-transform 150ms linear');	

				if(reverse){
					$from.css('-webkit-transform','translate'+translateOpen+'100%,0%'+translateClose);
				}else{
					$from.css('-webkit-transform','translate'+translateOpen+'-100%,0%'+translateClose);	
				}

				if ( !none ) {
					transitionComplete($from,cleanFrom);
				}

				//startIn();
			},

			cleanFrom = function() {
				$from.removeClass( $.mobile.activePageClass).height( '' );	
			},

			startIn = function() {

				// Prevent flickering in phonegap container: see comments at #4024 regarding iOS
				$to.css( "z-index", -10 );
				
				if(!none && !reverse){
					$to.css('-webkit-transform','translate'+translateOpen+'100%,0%'+translateClose);
				}
				$to.addClass( $.mobile.activePageClass);// + toPreClass );

				$to.css('-webkit-transition','-webkit-transform 150ms linear');

				// Send focus to page as it is now display: block
				$.mobile.focusPage( $to );

				// Set to page height
				$to.height( screenHeight + toScroll );

				scrollPage();

				// Restores visibility of the new page: added together with $to.css( "z-index", -10 );
				$to.css( "z-index", "" );

				if ( !none ) {
					transitionComplete($to,doneIn);
				}

				//$to.removeClass( toPreClass );

				if(!none){
					$to.css('-webkit-transform','translate'+translateOpen+'0%,0%'+translateClose);
				}

				if ( none ) {
					doneIn();
				}

			},

			doneIn = function() {

				$to.height( "" );

				toggleViewportClass();

				$to.css('-webkit-transform','none');
				$to.css('-webkit-transition','none');

				// In some browsers (iOS5), 3D transitions block the ability to scroll to the desired location during transition
				// This ensures we jump to that spot after the fact, if we aren't there already.
				if ( $( window ).scrollTop() !== toScroll ) {
					scrollPage();
				}

				deferred.resolve( name, reverse, $to, $from, true );
			};

		if (window.WebKitCSSMatrix){
			var m = new WebKitCSSMatrix();

			translateOpen = 'm11' in m ? '3d(':'(';
			translateClose = 'm11' in m ? ',0)':')';
		}

		toggleViewportClass();

		if ( $from && !none ) {
			startOut();
		}

		startIn();
		// else {
		// 	startIn();
		// }

		return deferred.promise();
}

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
		_history : {
			state : {},
			replace : function (opt) {
				var state = history.state,
				path = $.mobile.path.parseLocation();
				
				opt = $.extend(true, {
						filename : path.filename
					}, opt);
				this.state = $.extend(true, opt, state);
			}
		},
		_create : function () {
			var pageHtml = "<div id='shell_page' data-role='page'></div>",
			origin = $(this._originalHtml);
			
			this.firstPage.page = origin;
			
			$(doc.body).append(pageHtml);
			$("#shell_page").append(this._header())
			.append("<div id='shell_content' data-role='content' class='cs-content' style='padding:0' ></div>");
			
			$("#shell_content").append(origin);
			$("#shell_page").append(this._footer());
			
			var $this = this;
			
			$("#shell_page").live("pagebeforecreate", function (e) {
				var target = e.target,
				id = target.id,
				firstPage = $this.firstPage.page;
				
				//because the first nested page can not update the history ,if the page is the first nested page ,then replace the url
				if (id !== "shell_page") {
					return;
				}
				
				$.mobile.defaultPageTransition = "none";

				//change the global page container
				$.mobile.pageContainer = $('#shell_content');
				//add the page classes onto the nested screen page
				firstPage.addClass("ui-page  ui-page-active");
				//set the first page of jquery mobile to first page of shell
				$.mobile.firstPage = firstPage;
				//load the screen page into the content
				$.mobile.loadPage('#' + firstPage.attr('id'));
				
				var path = $.mobile.path.parseLocation();
				$this.firstPage.url = path.filename;
				
				$this._history.replace({
					page : firstPage.attr('id')
				});
				
			});
			
			$(doc).live('pageshow', function (e) {
				var height = $this.getContentHeight(),
				target = e.target,
				id = target.id,
				title = target.title;
				
				if (id === 'shell_page') {
					$.mobile.defaultPageTransition = "slide";

					$.mobile.activePage = $this.firstPage.page;
					$this.firstPage.page.css('min-height', height)
					.css('max-height', height);
					$('#shell_content').css('max-height', height);
					
					$this.firstPage.page.trigger('pagebeforeshow');

					return;
				}
				$(target).css('min-height', height)
				.css('max-height', height);
				
				$this.setTitle(title);
				$this._history.replace({
					page : id,
					title : title
				});
			});
			
			$(wind).bind('orientationchange', function (e) {
				var page = $('#shell_content').find('.ui-page-active');
				
				if (page.length) {
					//because on andriod the height updating is later then
					//orientationchange,so we delay the height resetting,and becasue
					//the iscroll refreshes 200s after orientationchange,to make sure
					//the iscroll could get the updated height,set 100s delay
					setTimeout(function () {
						var height = $this.getContentHeight();
						
						page.css('min-height', height)
						.css('max-height', height);
						$('#shell_content').css('max-height', height);
					}, 100);
				}
			});
		},
		_data : {},
		firstPage : {
			page : {},
			url : ''
		},
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
		_bind : function (fn, listeners) {
			listeners.push(fn);
		},
		_unbind : function (fn, listeners) {
			if (!fn || !listeners.length)
				return;
			
			for (var i in listeners) {
				var _fn = listeners[i];
				if (fn === _fn)
					listeners.splice(i, 1);
			}
		},
		_navPrefix : "shell_nav_",
		getContentHeight : function () {
			var total = window.innerHeight || $(window).height();
			
			return total - 44 - 59;
		},
		set : function (key, value) {
			this.options[key] = value;
		},
		onNav : function (fn) {
			this._bind(fn, this._navListeners);
		},
		unNav : function (fn) {
			this._unbind(fn, this._navListeners);
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
			ul = $("#shell_navs"),
			isHasNavbar = true,
			$this = this;
			
			if (!bar.length) {
				isHasNavbar = false;
				
				bar = $("<div id='shell_navbar' data-role='navbar'></div>");
				ul = $("<ul id='shell_navs'></ul>");
			}
			
			var navClick = function (el, nav) {
				el.click(function () {
					var firstPage = $this.firstPage.page;
					//if the activepage is shell_page means that it is first load
					var fromPage = ($.mobile.activePage.length &&
						$.mobile.activePage !== firstPage) ? $.mobile.activePage : firstPage;
					
					var state = $this._history.state;

					$.fm.utility.log("navigation click: ",nav.title,state);

					//because first page isn't removed from dom, when the nav is clickd,
					//it is necessary to check if the nav's target url is first page,if it is
					//navigate to first page ,otherwise navigate to the nav's target url
					if (nav.url !== $this.firstPage.url) {
						if (nav.url && state.filename !== nav.url) {
							$.fm.utility.log('change page to:'+nav.url);
							$.mobile.changePage(nav.url, {
								fromPage : fromPage,
								data : nav.data,
								reloadPage : true
							});
						}
					} else if ($.mobile.activePage !== firstPage) {
						$.fm.utility.log('change page to:',firstPage);
						$.mobile.changePage(firstPage, {
							fromPage : fromPage,
							data : nav.data,
							reloadPage : true
						});
					}
					
					for (var i in $this._navListeners) {
						var fn = $this._navListeners[i];
						
						fn(nav);
					}
					
					$.fm.shell.curNav = nav;
					$.fm.shell.setTitle(nav.title);
				});
			};
			
			for (var i in navs) {
				var nav = navs[i],
				icon = nav.icon || "grid";
				
				var li = $("<li></li>"),
				theme = nav.theme || "a";
				var a = $("<a id='" + $this._navPrefix + nav.id + "' data-theme='" + theme + "' data-icon='" + icon + "'>" + nav.title + "</a>");
				
				if (i == this.options.activeNav)
					a.addClass("ui-btn-active");
				
				navClick(a, nav);
				
				li.append(a);
				ul.append(li);
				
				$this._navs[nav.id] = nav;
				
			}
			if (!isHasNavbar) {
				bar.append(ul);
				$("#shell_footer").append(bar);
			}
			
			bar.navbar();
		},
		hideNavs : function (navs) {
			var $this = this;
			if (!navs) {
				for (var n in this._navs) {
					$("#" + $this._navPrefix + n).css("display", "none");
				}
			} else {
				for (var ni in navs) {
					$("#" + $this._navPrefix + navs[ni]).css("display", "none");
				}
			}
		},
		showNavs : function (navs) {
			var $this = this;
			if (!navs) {
				for (var n in this._navs) {
					$("#" + $this._navPrefix + n).css("display", "block");
				}
			} else {
				for (var ni in navs) {
					$("#" + $this._navPrefix + navs[ni]).css("display", "block");
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
				$("#" + this._navPrefix + this.curNav.id).removeClass("ui-btn-active");
			}
			var navdom;
			//if the q is string then use it as id else as index
			if (typeof q === "String") {
				navdom = $("#" + this._navPrefix + q);
			} else {
				var nav = this._getNav(q);
				//this.curNav = nav;
				navdom = $("#" + this._navPrefix + nav.id);
			}
			
			navdom.addClass("ui-btn-active");
			if (exc)
				navdom.trigger("click");
		},
		showLoading : function (opt) {
			$.mobile.pageContainer = $(doc.body);
			$.mobile.loading("show", opt);
			$.mobile.pageContainer = $("#shell_content");
		},
		hideLoading : function () {
			$.mobile.loading("hide");
		},
		setTitle : function (title) {
			var header = $("#shell_header").find('h1');
			var t = title || this.curNav.title;
			header.text(title);
		}
	};
	
	$.fm = {};
	
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
		},
		log:function (args) {
			if(this.isString(args)){
				this.logatomic(args);
			}else if(this.isArray(args)){
				var that = this;
				for(var i in args){
					var arg = args[i];

					if(that.isString(arg)){
						that.logatomic(arg);
					}else if(that.isObject(arg)){
						that.logObj(arg);
					}
				}
			}else if(this.isObject(args)){
				this.logObj(args);
			}

			if(!arguments.length)
				return;

			var exArgs = Array.prototype.slice.call(arguments,1),
				that = this;
			for(var i in exArgs){
				var ex = exArgs[i];

				that.log(ex);
			}

		},
		logObj:function (obj) {
			var m = this.getObjInfo(obj),
				str = '';

			for(var i=0;i<m.length;i++){
				str+= m.getKey(i)+':'+m.getValue(i)+'\n';
			}

			this.logatomic(str);
		},
		logatomic:function (info) {
			console.log(info);
		},
		isObject:function(obj){
			return typeof obj === 'object';
		},
		isFunction:function(obj){
			return typeof obj === 'function';
		},
		isArray:function (obj) {
			return obj instanceof Array && obj['push'] != undefined;
		},
		isString:function (obj) {
			return typeof obj === 'string';
		}
	};
	
})(jQuery, window, document);

//create all widgets
function createWidgets($, wind, doc) {
	
	$.widget("news.datagrid", {
		options : {},
		_create : function () {
			var options = {
				url : "",
				type : "GET",
				data : {},
				dataType : "json",
				linkUrl : "detail.html",
				pageSize : 15,
				caching : true
			};
			
			this.options = $.extend(true, options, this.options);
		},
		_init : function () {},
		_update : function () {},
		_destory : function () {
			$.Widget.prototype.destroy.call(this);
		},
		_exec : function (e) {
			var fun = this.options[e],
			args = Array.prototype.slice.call(arguments,1);
			if (fun)
				fun.call(this, args);
		},
		_render : function (data, options) {
			var $this = this;
			if (data.length) {
				var grid = this.element;
				grid.empty();
				
				for (var index in data) {
					var newItem = data[index],
					key = grid.attr('id') + '_' + 'item_' + index;
					
					if (!options.fromCahce)
						newItem.image.path = newItem.image.path ? "http://61.129.42.57:9080/fudan/" + newItem.image.path : "css/images/defaultnew.gif";
					
					var item = $("<li><a href='" + this.options.linkUrl + "'><img style='margin:0.6em 0;max-height:60px;min-height:60px;' src='" + newItem.image.path + "' /><h6>" + newItem.titleNews + "</h6><p>"+newItem.descNews+"</p><p>" + newItem.from + "</p></a></li>");
					
					item.attr("id", key)
					.jqmData(key, newItem)
					.click(function () {
						var cur = grid.jqmData('current_item');
						if (cur) {
							$('#' + cur.id).removeClass('ui-btn-active');
						}
						
						grid.jqmData("current_item", {
							id : this.id,
							data : $(this).jqmData(this.id)
						});
					});

					grid.append(item);
				}
				
				this.element.listview("refresh");
			}
		},
		_firstLoad : true,
		_getDataServer : function () {
			var $this = this;
			var data = $.extend(true,this.options.data,{pageNo:this.currentIndex});
			$.ajax({
				url : this.options.url,
				type : this.options.type,
				data : data,
				dataType : this.options.dataType,
				success : function (data) {
					if (data && data.jsonp && data.jsonp.data && data.jsonp.data.status === 1) {
						var news = data.jsonp.data.data.newsList;
						$this.totalCount = news.length;
						//paging logic
						// var dNews = [],
						// opt = $this.options;
						// if ($this.totalCount) {
						// 	var fIndex = ($this.currentIndex - 1) * opt.pageSize,
						// 	tIndex = $this.currentIndex * opt.pageSize;
							
						// 	tIndex = tIndex > $this.totalCount ? $this.totalCount : tIndex;
							
						// 	var v = $this.totalCount % opt.pageSize,
						// 	p = $this.totalCount / opt.pageSize;
						// 	if (v)
						// 		$this.totalPage = Math.floor(p) + 1;
						// 	else
						// 		$this.totalPage = p;
							
						// 	if (fIndex <= news.length - 1) {
						// 		for (var i = fIndex; i < tIndex; i++) {
						// 			dNews.push(news[i]);
						// 		}
						// 	}
						// }
						// //alert("render data from server");
						$this._render(news, {
							fromCahce : false
						});

						if ($.fm.db) {
							var db = $.fm.db.getdb("news", {
									isDebug : false
								});

							$.fm.utility.log('get news db:',db);
							
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
							$.fm.utility.log('add data to news');
						}
						
						$this._exec('success');
					} else {
						$this._exec('error');
					}
				}
			});
		},
		_getData : function () {
			var $this = this;
			
			if (this.options.caching && $.fm.db && this._firstLoad) {
				var db = $.fm.db.getdb("news", {
						isDebug : false
					});
				
				db.createtb("NEWS", {
					primary : "id",
					fields : ["id", "data"]
				});
				db.query("NEWS", {
					filter : {
						id : this.options.data
					},
					fields : ["data"],
					onComplete : function (data) {
						if (data.length) {
							$this._render(data[0].data, {
								fromCahce : true
							});
							
							$this._exec('success');
						} else {
							$this._getDataServer();
						}
					}
				});
			} else {
				$this._getDataServer();
			}
			
			this._firstLoad = false;
			
		},
		refresh : function () {
			this._getData();
		},
		currentIndex : 1,
		totalPage : 1,
		totalCount : 0,
		next : function () {
			this.currentIndex += 1;
			this.refresh();
		},
		prev : function () {
			if (this.currentIndex === 1) {
				this._exec('success');
				return;
			}
			
			this.currentIndex -= 1;
			this.refresh();
		}
		
	});
}

function loadBizs($, wind, doc) {
	
	(function news_page() {
		var self = {
		};
		//refresh the datagrid
		var refNews = function (options) {
			var grid = $("#news_ul").data("datagrid");
			if (grid) {
				grid.option({
					data : options.data,
					caching : false
				});
				$.fm.shell.showLoading();
				grid.refresh();
				self.scroller.scrollTo(0,self.topOffset,0,null);
				
			}
		};
		
		var createScroller = function () {
			var pullDownEl = $('.cs-pull-down'),
			pullUpEl = $('.cs-pull-up');
			
			pullDownEl.show();
			pullUpEl.show();
			
			pullDownOffset = pullDownEl.length ? pullDownEl[0].offsetHeight : 0,
			pullUpOffset = pullUpEl.length ? pullUpEl[0].offsetHeight : 0;

			self.topOffset=pullDownOffset;
			
			self.scroller = new iScroll('news_content', {
					useTransform : true,
					topOffset : pullDownOffset,
					onRefresh : function () {
						if (pullDownEl.hasClass('cs-pull-down-loading')) {
							pullDownEl.removeClass('cs-pull-down-loading');
							pullDownEl.find('.cs-pull-down-lb').html('Pull down to refresh...');
						} else if (pullUpEl.hasClass('cs-pull-up-loading')) {
							pullUpEl.removeClass('cs-pull-up-loading');
							pullUpEl.find('.cs-pull-up-lb').html('Pull up to load more...');
						}
					},
					onScrollMove : function () {
						if (this.y > 5 && !pullDownEl.hasClass('cs-pull-down-flip')) {
							pullDownEl.addClass('cs-pull-down-flip');
							pullDownEl.find('.cs-pull-down-lb').html('Release to refresh...');
							this.minScrollY = 0;
						} else if (this.y < 5 && pullDownEl.hasClass('cs-pull-down-flip')) {
							pullDownEl.removeClass('cs-pull-down-flip');
							pullDownEl.find('.cs-pull-down-lb').html('Pull down to refresh...');
							this.minScrollY = -pullDownOffset;
						} else if (this.y < (this.maxScrollY - 5) && !pullUpEl.hasClass('cs-pull-up-flip')) {
							pullUpEl.addClass('cs-pull-up-flip');
							pullUpEl.find('.cs-pull-up-lb').html('Release to refresh...');
							this.maxScrollY = this.maxScrollY;
						} else if (this.y > (this.maxScrollY + 5) && pullUpEl.hasClass('cs-pull-up-flip')) {
							pullUpEl.removeClass('cs-pull-up-flip');
							pullUpEl.find('.cs-pull-up-lb').html('Pull up to load more...');
							this.maxScrollY = pullUpOffset;
						}
					},
					onScrollEnd : function () {
						if (pullDownEl.hasClass('cs-pull-down-flip')) {
							pullDownEl.removeClass('cs-pull-down-flip').addClass('cs-pull-down-loading');
							pullDownEl.find('.cs-pull-down-lb').html('Loading...');
							self.grid.datagrid('prev');
						} else if (pullUpEl.hasClass('cs-pull-up-flip')) {
							pullUpEl.removeClass('cs-pull-up-flip').addClass('cs-pull-up-loading');
							pullUpEl.find('.cs-pull-up-lb').html('Loading...');
							self.grid.datagrid('next');
						}
					}
				});
		};
		
		var addNavs = function () {
			$.fm.shell.addNavs(
				[{
						id : "hotNews",
						title : "学校要闻",
						icon : "grid",
						url : 'index.html',
						data : {
							codeType : "xxyw"
						}
					}, {
						id : "syntheticalNews",
						title : "综合要闻",
						icon : "grid",
						url : 'index.html',
						data : {
							codeType : "zhxw"
						}
					}, {
						id : "mediaNews",
						title : "媒体视角",
						icon : "grid",
						url : 'index.html',
						data : {
							codeType : "mtsj"
						}
						
					}, {
						id : "alumni",
						title : "校友动态",
						icon : "grid",
						url : 'index.html',
						data : {
							codeType : "xydt"
						}
					}
				]);
			$.fm.shell.activeNav(0);
		};
		
		$("#news_page").live("pagebeforeshow", function (event) {
			if (!$.fm.shell.hasNav()) addNavs();
			
			var nav = $.fm.shell.curNav,
			codeType = nav.data && nav.data.codeType || "xxyw",
			grid = $("#news_ul").datagrid({
					url : "http://61.129.42.57:9080/fudan/sid/newsService/vid/index",
					type : "POST",
					data : {
						codeType : codeType
					},
					linkUrl : "detail.html",
					dataType : "jsonp",
					success : function () {
						//self.scroller = new iScroll('news_content');
						if (self.scroller) {
							self.scroller.refresh();
						} else {
							createScroller();
						}
						
						$.fm.shell.hideLoading();
					}
				});
			
			self.grid = grid;
			$.fm.shell.showLoading();
			self.grid.datagrid("refresh");
			// setTimeout(function () {
			// 	self.grid.datagrid("refresh");
			// }, 0);
			
			//listen to the navigation event from shell
			$.fm.shell.onNav(refNews);
		});
		//when the news page has been removed ,remove the event listeners
		$("#news_page").live("pageremove", function (event) {
			self.scroller.destroy();
			self.scroller = null;
			
			$.fm.shell.unNav(refNews);
		});
		
	})();
	
	(function detail_page() {
		
		$("#detail_page").live("pagebeforecreate", function (e) {
			var current = $("#news_ul").jqmData("current_item");
			
			if (!current)
				return;
			
			var title = current.data.titleNews;
			e.target.title = title;
			$(e.target).attr('data-title', title);
			
			var author = current.data.author || "",
			time = current.time || "";
			var html = "<h2>" + current.data.titleNews + "</h2>" +
				"<h6>"+current.data.from+"</h6>" +
				"<span id='new_image' style='float:right'><img alt='' src='" + current.data.image.path + "' /></span>" +
				"<p>" + current.data.descNews + "</p>";
			var content = $("#detail_content").html(html);
			
		});
	})();
}