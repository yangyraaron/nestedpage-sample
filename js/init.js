(function ($,window,doc) {
	var require,define;

	(function () {
		var modules = [];

		function build(module){
			var factory = module.factory;
			delete module.factory;

			module.exports = {};
			factory(require,module.exports,module);

			return module.exports;
		}

		require = function (id) {
			var module = modules[id];

		 	if(!modules[id]){
		 		throw 'module '+id+' not found';
		 	}	
		 	return module.factory?build(module):module.exports;
		};

		define = function(id,factory) {
			if(modules[id]){
				throw 'module '+id+'already definded';
			}

			modules[id] = {id:id,factory:factory}
		};

		define.remove = function(id) {
			delete modules[id];	
		};

	})();

	define('config',function (require,exports,module) {
		var utility = require('mex/utility'),
			platform = undefined;

		if(utility.isAndroid()){
				platform={android:'android'};
			}else if(utility.isIDevice){
				platform={ios:'ios'};
			}else if(utility.isTouchPad){
				platform={touch:'ouch pad'}
		}

		exports.jQuery = $;
		exports.window = window;
		exports.doc = document;
		exports.logLevel = 'info';
		exports.platform = platform;
	});

	define('mex',function(require,exports,module){
		var $ = require('config').jQuery,
			device = require('mex/device').device,
			shell = require('mex/shell');

		//device.waiting();

		exports.device = device;
		exports.init = function(){
			var that = this;
			$(function () {
				that.shell = shell.createShell();
			});
		};

	});

	define('mex/database',function (require,exports,module) {
		var $ = require('config').jQuery,
			utility = require('mex/utility'),
			logger = require('mex/log').getLogger();

		var database = function (db, options) {
			var opt = {
				version : "1.0",
				name : db,
				size : 20971520 //20m
			};
			this.options = $.extend(true, opt, options);
		
			this.db = window.openDatabase(db,
				this.options.version,
				this.options.name,
				this.options.size);
		
			var log = "database: " + db + ":" + this.options.version + ":" + this.options.name + ":" + this.options.size;

			logger.logInfo(log);
		};
	
		database.prototype = {
			_errHandler : function (func, sql, err,onerror) {
				var msg = "code: " + err.code + " msg: " + err.message;
			
				logger.logError("error:executing sql " + sql + " of " + func + " on database " + this.options.name + " error:" + msg);

				if(onerror) onerror(err);
			},
			_exec : function (func, sql, onComplete,onerror) {
				var that = this;
			
				logger.logInfo('begin to excute sql: '+sql);
				this.db.transaction(function (tx) {
				tx.executeSql(sql, [],
					function (tx, results) {
					
						var data = [];
					
						var raf = results.rowsAffected;

						var strMsg = "sql: " + sql + "\n rowsAffected: " + raf + "\n insertId: " +
							results.insertId + "\n row: " + results.rows.length;

						logger.logInfo(strMsg);

						//if the sql is not query then return the rows affected
						//else return the queried data array
						if (raf) {
							data.push(raf);
						} else {
							var len = results.rows.length;
							for (var i = 0; i < len; i++) {
								var d = results.rows.item(i),
								m = utility.getObjInfo(d),
								mlen = m.length;
								
								logger.logInfo('results item: ',d);
								for (var j = 0; j < mlen; j++) {
									m.setValue(j, JSON.parse(unescape(m.getValue(j))));
								}
								
								data.push(d);
							}
						}

						if (!onComplete)
							return;

						logger.logInfo('the result data: ',data);
						onComplete(data);

					}, function (err) {
						that._errHandler("executeSql error: " + func, sql, err,onerror);
					});
				},
				function (err) {
					that._errHandler("transaction error: " + func, sql, err,onerror);
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
					var mtx = utility.getObjInfo(filter);
					
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
				
				this._exec("createtb", sql, options.onComplete,options.onerror);
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
				},options.onerror);
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
				that = this;
				
				this.createtb(tb, {
					primary : primary,
					fields : keys,
					onComplete : function () {

						var exe = function (tb, primary, filter, keys, rd) {
							that.has(tb, {
								filter : filter,
								onComplete : function (exists) {
									var sql = "";
									//if the key of data already have ,then update it,else insert it
									if (exists) {
										sql = that._update(tb, primary, filter, keys, rd);
									} else {
										sql = that._insert(tb, keys, rd);
									}
									that._exec("add", sql);
								},
								onerror:options.onerror
								});
						};

						for (var i in data) {
							var d = data[i],
							pValue = d[primary],
							filter = {};
							
							filter[primary] = pValue;
							
							exe(tb, primary, filter, keys, d);
							
						}
					},
					onerror:onerror
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
				
				this._exec("query", sql, onComplete,options.onerror);
			},
			del : function (tb, options) {
				if (!this._verifydb()) {
					return;
				}
				
				var sql = 'DELETE FROM ' + tb;
				sql += this._filter(options.filter);
				
				this._exec("del", sql, options.onComplete,options.onerror);
			}
		};

		exports.getdb = function (db, options) {
			return new database(db, options);
		};
	});

	define('mex/device',function (require,exports,module) {
		var log = require('mex/log'),
			logger = log.getLogger();

		var device = {
			_readyListeners:[],
			_execReady:function () {
				logger.logInfo('device ready');

				var len = this._readyListeners.length;
				if(len){
					for(var i=0;i<len;i++){
						var l = this._readyListeners[i];

						l();
					}

				}

				delete this._readyListeners;
			},
			simulateReady:function () {
				this.isReady = true;
				this._execReady();
			},
			waiting:function () {
				var that = this;
				doc.addEventListener("deviceready", function () {
					that.isReady = true;
					that._execReady();	
				}, false);
			},	
			isReady:false,	
			ready:function (fn) {
				if(fn)
					this._readyListeners.push(fn);
			},
			unReady:function (fn) {
				var len = this._readyListeners.length;

				if (!fn || !len)
					return;
				
				for (var i=0;i<len;i++) {
					var _fn = this._readyListeners[i];
					if (fn === _fn){
						this._readyListeners.splice(i, 1);

						return;
					}
				}
			}
			
		};

		exports.device = device;
		
	});

	define('mex/utility',function(require,exports,module) {
		exports.getObjInfo = function (obj) {
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
		};
		exports.isObject=function(obj){
				return typeof obj === 'object';
		};
		exports.isFunction=function(obj){
				return typeof obj === 'function';
		};
		exports.isArray=function (obj) {
				return obj instanceof Array && obj['push'] != undefined;
		};
		exports.isString=function (obj) {
				return typeof obj === 'string';
		};
		exports.isAndroid = function(){
			return (/android/gi).test(navigator.appVersion);
		};
		exports.isIDevice = function () {
			return (/iphone|ipad/gi).test(navigator.appVersion);
		};
		exports.isTouchPad = function(){
			return (/hp-tablet/gi).test(navigator.appVersion);
		};
		exports.loadImg = function (img,options) {
			var fullUrl = img.getAttribute('cs-src'),
			baseUrl = img.getAttribute('cs-baseUrl'),
			url = img.getAttribute('cs-url'),
			targetUrl='';

			/*user can choose two mode to set the img url
			one mode is to set the full url,in this mode don't check the url and
			always go to server to fetch the img.
			another mode is get a base url and a relative url,in this mode check
			if has the relative url, if has then go to server fetch it ,otherwise do nothing*/
			if(!fullUrl) targetUrl = baseUrl+url;

			function onload () {
				if(options.width) img.style.width = options.width;
				if(options.height) img.style.height = options.height;

				if(options.loading) options.loading();

				if(fullUrl){
					img.src = fullUrl;
				}else if(url){
					img.src = targetUrl;
				}

				img.removeEventListener('load',onload);
			}

			function onerror () {
				img.src = options.defaultUrl;

				img.removeEventListener('error',onerror);
			}

			img.addEventListener('load',onload,false);
			img.addEventListener('error',onerror,false);

			img.src = options.defaultUrl;

		};
		exports.createTimeTracker = function(){
			var timeTracker = function(){
				this._timeSlices = [];
			};

			timeTracker.prototype = {
				_getSlice: function(){
					var date = new Date();
					var curSlice = {minute:date.getMinutes(),
						second:date.getSeconds(),
						millisecond:date.getMilliseconds()};
					return curSlice;
				},
				_state:0,
				start:function(){
					this._state = 1;

					var date = new Date(),
						curSlice = this._getSlice();

					this._timeSlices.push(curSlice);
				},
				getInterval:function(){
					if(!this._state)
						return undefined;

					var curSlice = this._getSlice();

					var interval = undefined;

					if(this._timeSlices.length){
						var lastSlice = this._timeSlices.pop();
						interval = {
							minute:curSlice.minute-lastSlice.minute,
							second:curSlice.second-lastSlice.second,
							millisecond:curSlice.millisecond-lastSlice.millisecond
						};
					}

					this._timeSlices.push(curSlice);

					return interval;
				},
				finish:function(){
					this._timeSlices = [];
					this._state = 0;
				}
			};

			return new timeTracker();
		};
	});
	
	define('mex/log',function (require,exports,module) {
		var utility = require('mex/utility'),
			config = require('config');

		var logger = function (level) {
			if(level){
				this.setLevel(level);				
			}else if(config.logLevel){
				this.setLevel(config.logLevel);
			}
		};

		logger.prototype = {
			_level:1,
			_levelHash:{'error':1,'warning':2,'info':3},
			getLevel:function () {
				return this._level;
			},
			setLevel:function (val) {
				//if the value is not string then set it to level
				//esle find the level value from hash and set the value to level
				if(!utility.isString(val))
					this._level = val;
				else{
					var lev = this._levelHash[val];
					if(lev) this._level = lev;
				}
			},
			logError:function (args) {
				var exArgs = Array.prototype.slice.call(arguments,1);
				this._log(args,exArgs);
			},
			logWarning:function (args) {
				if(this._level<2)
					return;

				var exArgs = Array.prototype.slice.call(arguments,1);
				this._log(args,exArgs);
			},
			logInfo:function (args) {
				if(this._level<3)
					return;

				var exArgs = Array.prototype.slice.call(arguments,1);
				this._log(args,exArgs)	
			},
			_log:function (args) {
				if(utility.isString(args)){
					this.logatomic(args);
				}else if(utility.isArray(args)){
					var that = this;
					for(var i=0;i<args.length;i++){
						var arg = args[i];

						that._log(arg);
					}	
				}else if(utility.isObject(args)){
					this.logObj(args);
				}

				if(!arguments.length)
					return;

				var exArgs = Array.prototype.slice.call(arguments,1),
					that = this;
				for(var i=0;i<exArgs.length;i++){
					var ex = exArgs[i];

					that._log(ex);
				}

			},
			logObj:function (obj) {
				this.logatomic(JSON.stringify(obj));
			},
			logatomic:function (info) {
				console.log(info);
			}
		};

		exports.getLogger = function (level) {
			return new logger(level);
		};
	});

	define('mex/shell',function (require,exports,module) {
		var config = require('config'),
			$ = config.jQuery,
			logger = require('mex/log').getLogger();
			window = config.window,
			doc = config.doc;

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
				var header = $("<div id='shell_header' class='cs-header' data-role='header' data-title='" + this.options.title + "'><h1>" + this.options.title + "</h1>"+
					"</div>"),
					back =  $("<a href='javascript:void(0);' id='shell_back_btn' class='ui-btn-left ui-btn ui-shadow ui-btn-corner-all ui-btn-icon-left ui-btn-up-a' "+
								"data-rel='back' data-icon='arrow-l' data-theme='a' data-corners='true' data-shadow='true' data-iconshadow='true' "+
								"data-wrapperels='span'><span class='ui-btn-inner ui-btn-corner-all'><span class='ui-btn-text'>Back</span><span class='ui-icon ui-icon-arrow-l ui-icon-shadow'>&nbsp;</span></span></a>");

				header.append(back);

				return header;
			},
			_footer : function () {
				var html = "<div id='shell_footer' class='cs-footer' data-role='footer'></div>";
				return $(html);
			},
			_backButton:undefined,
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
				var pageHtml = "<div id='shell_page' style='overflow:hidden;' data-role='page'></div>",
				origin = $(this._originalHtml);
				
				this.firstPage.page = origin;
				
				$(doc.body).append(pageHtml).css('overflow','hidden');
				$("#shell_page").append(this._header())
				.append("<div id='shell_content' data-role='content' class='cs-content' style='padding:0' ></div>");
				
				$("#shell_content").append(origin).css('overflow','hidden');
				$("#shell_page").append(this._footer());
				
				var $this = this;
				
				$("#shell_page").live("pagebeforecreate", function (e) {
					var target = e.target,
						id = target.id,
						firstPage = $this.firstPage.page;
					
					$(target).css('overflow','hidden');
					//because the first nested page can not update the history ,if the page is the first nested page ,then replace the url
					if (id !== "shell_page") {
						return;
					}
					
					//$.mobile.defaultPageTransition = "none";

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
						//$.mobile.defaultPageTransition = "slide";

						$.mobile.activePage = $this.firstPage.page;
						$this.firstPage.page.css('min-height', height)
						.css('max-height', height);
						$('#shell_content').css('max-height', height);
						
						$this.firstPage.page.trigger('pageshow');

						return;
					}

					if(!this._backButton)
						this._backButton = $('#shell_back_btn');
					this._backButton.removeClass('ui-btn-active');

					$(target).css('min-height', height)
					.css('max-height', height);
					
					$this.setTitle(title);
					$this._history.replace({
						page : id,
						title : title
					});
				});
				
				$(window).bind('resize',function(e){
					//logger.logInfo('resizing:');

					$this._onresize();
				});

				$(window).bind('orientationchange', function (e) {
					$this._onresize();
				});
			},
			_onresize:function(){
				var page = $('#shell_content').find('.ui-page-active'),
					$this = this;
				
				if (page.length) {
					//because on andriod the height updating is later then
					//orientationchange,so we delay the height resetting,and becasue
					//the iscroll refreshes 200s after orientationchange,to make sure
					//the iscroll could get the updated height,set 180s delay
					setTimeout(function () {
						var height = $this.getContentHeight();
						
						page.css('min-height', height)
						.css('max-height', height);
						$('#shell_content').css('max-height', height);
					}, 180);
				}
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
				var len = listeners.length;
				if (!fn || !len)
					return;
				
				for (var i=0;i<len;i++) {
					var _fn = listeners[i];
					if (fn === _fn){
						listeners.splice(i, 1);

						return;					
					}

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
						$this.curNav = nav;

						var firstPage = $this.firstPage.page;
						//if the activepage is shell_page means that it is first load
						var fromPage = ($.mobile.activePage.length &&
							$.mobile.activePage !== firstPage) ? $.mobile.activePage : firstPage;
						
						var state = $this._history.state;

						logger.logInfo("navigation click: ",nav.title,state);

						//because first page isn't removed from dom, when the nav is clickd,
						//it is necessary to check if the nav's target url is first page,if it is
						//navigate to first page ,otherwise navigate to the nav's target url
						if (nav.url !== $this.firstPage.url) {
							if (nav.url && state.filename !== nav.url) {

								logger.logInfo('change page to:'+nav.url);

								$.mobile.changePage(nav.url, {
									fromPage : fromPage,
									data : nav.data,
									reloadPage : true
								});
							}
						} else if ($.mobile.activePage !== firstPage) {

							logger.logInfo('change page to first page: '+firstPage.attr('id') );

							$.mobile.changePage(firstPage, {
								fromPage : fromPage,
								data : nav.data,
								reloadPage : true
							});
						}
						
						for (var i=0;i<$this._navListeners.length;i++) {
							var fn = $this._navListeners[i];
							
							fn(nav);
						}
						
						//$this.setTitle(nav.title);
					});
				};
				
				for (var i=0;i<navs.length;i++) {
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
					for (var n=0;n<this._navs.length;n++) {
						$("#" + $this._navPrefix + n).css("display", "none");
					}
				} else {
					for (var ni=0;ni<this.navs.length;i++) {
						$("#" + $this._navPrefix + navs[ni]).css("display", "none");
					}
				}
			},
			showNavs : function (navs) {
				var $this = this;
				if (!navs) {
					for (var n=0;n<this._navs.length;n++) {
						$("#" + $this._navPrefix + n).css("display", "block");
					}
				} else {
					for (var ni=0;ni<this.navs;ni++) {
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
					this.curNav = nav;
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

		exports.createShell = function () {
			return new shell();
		};
		
	});

	define('mex/transition',function (require,exports,module) {
		var config = require('config'),
			window = config.window,
			$ = config.jQuery;

		exports.slide = function(name,reverse,$to,$from){
			var deferred = new $.Deferred(),
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
				transitionComplete = function (el,complete) {
					el.one('webkitTransitionEnd',function (e) {
						if(complete) complete();
					});
				},

				prepare = function () {
					//init to page,because of the javascript's one thread excuting,
					//the key point of animation is to make sure that when animation is starting,
					//everything that user can see have been already
					$to.css( "z-index", -10 );
					$to.addClass( $.mobile.activePageClass);
					$to.css('opacity',0);
					//$.mobile.focusPage( $to );
					$to.height(mex.shell.getContentHeight());

					//if the transition is indicated and has from page 
					if(!none && $from){
						//because when the animation completed,from page's transition always will be changed
						//so need to check if the animation starts when the from or page is aleady
						//var oldValue = $to[0].style.webkitTransform;
						if(reverse){
							$to.css('-webkit-transform',createTransform('-100%'));
						}else{
							$to.css('-webkit-transform',createTransform('100%'));
						}

						$from.css('-webkit-transform',createTransform('0%'));
						
						$from.css('-webkit-transition','-webkit-transform 0s linear');

						$to.css('-webkit-transition','-webkit-transform 0s linear');
						//go to already step as soon as possible
						window.setTimeout(function(){already();},0);
					}
					else{
						already();
					}
						
				},	
				already = function () {
					$to.css('opacity',1);
					$to.css( 'z-index', '' );

					startOut();
					startIn();

					if(!none && $from){
						$from.css('-webkit-transition','-webkit-transform 350ms ease-out');

						$to.css('-webkit-transition','-webkit-transform 350ms ease-out');
					}
				},
				startOut = function() {
					if(none || !$from)
						return;

					if(reverse){
						$from.css('-webkit-transform',createTransform('100%'));
					}else{
						$from.css('-webkit-transform',createTransform('-100%'));	
					}
				},

				cleanFrom = function() {
					$from.removeClass( $.mobile.activePageClass);//.height( '' );
				},

				startIn = function() {

					if ( !none ) {
						transitionComplete($to,doneIn);
					}

					if(!none && $from){
						$to.css('-webkit-transform',createTransform('0%'));
					}

					if ( none ) {
						doneIn();
					}

				},

				doneIn = function() {
					if(!none && $from)
						cleanFrom();

					$to.css('-webkit-transform','none');
					$to.css('-webkit-transition','none');

					deferred.resolve( name, reverse, $to, $from, true );
				};

			if (window.WebKitCSSMatrix){
				var m = new WebKitCSSMatrix();

				translateOpen = 'm11' in m ? '3d(':'(';
				translateClose = 'm11' in m ? ', 0px)':')';
			}

			var createTransform = function(x) {
				return 'translate'+translateOpen+x+', 0%'+translateClose;
			};


			prepare();

			return deferred.promise();
		};
	});
	
	var mex = require('mex');
	mex.init();

	define('news/main',function(require,exports,module){
		var transition = require('mex/transition'),
			config = require('config'),
			widgets = require('news/widgets'),
			newsPage = require('news/news_page'),
			detailPage = require('news/detail_page'),
			$ = config.jQuery;


		exports.run = function(){
			$(document).bind("mobileinit", function () {

				$.mobile.defaultPageTransition = "slide";
				//$.mobile.page.prototype.options.addBackBtn = true;
				$.mobile.loader.prototype.options.text = "loading...";
				//$.mobile.loader.prototype.options.textonly=true;
				$.mobile.loadingMessageTextVisible = true;

				//enable phonegap features
				$.mobile.phonegapNavigationEnabled = true;
				$.mobile.pushStateEnabled = false;
				//in phonegap apps,these two features must be set to true
				$.support.cors = true;
				$.mobile.allowCrossDomainPages = true;

				//custom features
				$.mobile.transitionHandlers["slide"] = transition.slide;
				$.mobile.defaultTransitionHandler = transition.slide;
				
				//load the buisness logic
				widgets.create();
				newsPage.run();
				detailPage.run();
			});
		};

	});
	
	define('news/widgets',function(require,exports,module){
		var logger = require('mex/log').getLogger(),
			utility = require('mex/utility'),
			database = require('mex/database'),
			device = require('mex').device,
			config = require('config'),
			$ = config.jQuery;

		exports.create = function(){
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
				_exec : function (obj,e) {
					var fun = obj[e],
					args = Array.prototype.slice.call(arguments,2);
					if (fun)
						fun.call(this, args);
				},
				_render : function (data, options) {
					logger.logInfo('begin rendering data');

					var $this = this;
					if (data.length) {
						var grid = this.element;

						//if the grid has been resetted ,then clear the grid
						if(this.currentIndex==1)
							grid.empty();

						//var tracker = utility.createTimeTracker();
						function itemclick (item,grid,data,url) {
							// item.bind('tap',function(){logger.logInfo('tap click time:',tracker.getInterval());
							// });
							// item.bind('vmousedown',function(){
							// 	logger.logInfo('time tracker started');

							// 	tracker.start();
							// 	logger.logInfo('mouse down time:',tracker.getInterval());});
							// item.bind('vmouseup',function(){logger.logInfo('mouse up time:',tracker.getInterval());});

							item.bind('vclick',function(){
								//logger.logInfo('vclick time:',tracker.getInterval());
								
								item.addClass('ui-btn-active');

								var old = $this.selectedItem.item;
								if(old){
									old.removeClass('ui-btn-active');
								}

								$.mobile.changePage(url);

								$this.selectedItem.item = item;
								$this.selectedItem.data = data;
							});
							// item.bind('click',function(){
							// 	logger.logInfo('click time:',tracker.getInterval());
							// 	tracker.finish();
							// 	logger.logInfo('time tracker finished');
							// });
						}
						
						for (var index=0;index<data.length;index++) {
							var newItem = data[index];
							
							var dPath = "css/images/default.png",
								baseUrl = "http://61.129.42.57:9080/fudan/",
								imgUrl = newItem.image.path;
								//key = "news_item_"+(index+1)*$this.currentIndex;
							
							var item = $("<li data-theme='c' class='ui-btn ui-btn-icon-right ui-li-has-arrow'>"+
										"<img class='cs-img' style='margin:0.6em 10px' width='80px' height='60px' cs-baseUrl='"+baseUrl+"' cs-url='"+imgUrl+"' />"+
										"<h6 style='margin:0em 0 0.6em 0'>" + newItem.titleNews + "</h6><p>"+newItem.descNews+"</p>"+
										"<div><p style='max-width:100px;text-overflow:ellipsis;float:left;'>" + newItem.from + 
										"</p><p style='float:right'>"+newItem.time+"</p></div>"+
										"<span style='position:absolute;top:50%;margin-top:-9px;background-position:-108px 50%' class='ui-icon ui-icon-arrow-r ui-icon-shadow'>&nbsp;</span></li>");

							var img = item.find('img');
							utility.loadImg(img[0],{defaultUrl:dPath});

							itemclick(item,grid,newItem,this.options.linkUrl);

							grid.append(item);
						}
						
						this.element.listview("refresh");
					}

					logger.logInfo('finish rendering data');
				},
				_firstLoad : true,
				_getDataServer : function (options) {
					var $this = this;

					logger.logInfo('get data from server','pageNo: '+options.data.pageNo);

					$.ajax({
						url : options.url,
						type : options.type,
						data : options.data,
						dataType : options.dataType,
						success : function (data) {
							if (data && data.jsonp && data.jsonp.data && data.jsonp.data.status === 1) {
								var news = data.jsonp.data.data.newsList;
								$this.totalCount = news.length;

								$this._render(news);
							
								if (device.isReady && options.caching) {
									var db = database.getdb("news");

									logger.logInfo('get news db:',db);
									logger.logInfo('begin adding news count:',news.length,' to db: ')
									
									db.add("NEWS", {
										primary : "id",
										data : [{
												id : options.data,
												data : news
											}
										],
										onComplete : function (ar) {
											logger.logInfo('finish adding data to news');
										},
										onerror:function(err){
											logger.logInfo('add news failed!');
										}
									});
								}
								
								$this._exec(options,'success');
							} else {
								$this._exec(options,'error');
							}
						},
						error:function  (jqXHR, textStatus, errorThrown) {
							$this._exec(options,'error',textStatus,errorThrown);
						}
					});
				},
				_getData : function (options) {
					var $this = this;

					$.extend(true,options.data,{pageNo:this.currentIndex});
					
					if (device.isReady && options.caching && this._firstLoad) {
						var db = database.getdb("news");
						
						db.createtb("NEWS", {
							primary : "id",
							fields : ["id", "data"]
						});

						logger.logInfo('create news db');
						logger.logInfo('begin getting news from database');

						db.query("NEWS", {
							filter : {
								id : options.data
							},
							fields : ["data"],
							onComplete : function (data) {
								logger.logInfo('finish getting data from db data count : ',data.length);

								if (data.length) {
									$this._render(data[0].data);
									
									$this._exec(options,'success');
								} else {
									logger.logInfo('no data was found in db');

									$this._getDataServer(options);
								}
							},
							onerror:function(err){
								logger.logInfo('query news failed!');

								$this._getDataServer(options);
							}
						});
					} else {
						$this._getDataServer(options);
					}
					
					this._firstLoad = false;
					
				},
				refresh : function (options) {
					var opt = $.extend(true,this.options,options);

					this._getData(opt);
				},
				currentIndex : 1,
				totalPage : 1,
				totalCount : 0,
				selectedItem:{data:undefined,item:undefined},
				next : function (options) {
					this.currentIndex += 1;

					this.refresh(options);
				},
				prev : function (options) {	
					this.reset();
					this.refresh(options);
				},
				reset:function () {
					this.currentIndex = 1;
				}
				
			});
		};

	});

	define('news/news_page',function(require,exports,module){
		var mex = require('mex'),
			logger = require('mex/log').getLogger(),
			utility = require('mex/utility'),
			config = require('config'),
			$ = config.jQuery;

		exports.run = function news_page() {
			var self = {
			};
			//refresh the datagrid
			var refNews = function (options) {
				var grid = $("#news_ul").data("datagrid");

				mex.shell.setTitle(mex.shell.curNav.title);

				if (grid) {
					grid.reset();
					grid.option({
						data : options.data,
						caching : false
					});

					mex.shell.showLoading();

					grid.refresh({success : function () {
						onDataLoaded();

						self.scroller.scrollTo(0,self.topOffset,0,null);
						}});
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

				var useTransform = config.platform.android? true:false;

				logger.logInfo('the platform is:',config.platform,'iscorll use transform:'+useTransform);

				self.scroller = new iScroll('news_content', {
						useTransform : useTransform,
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
								self.grid.datagrid('prev',{success:refreshScroller});
							} else if (pullUpEl.hasClass('cs-pull-up-flip')) {
								pullUpEl.removeClass('cs-pull-up-flip').addClass('cs-pull-up-loading');
								pullUpEl.find('.cs-pull-up-lb').html('Loading...');
								self.grid.datagrid('next',{success:refreshScroller});
							}
						}
					});
			};

			var refreshScroller = function () {
				self.scroller.refresh();
			};
			
			var addNavs = function () {
				mex.shell.addNavs(
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
				mex.shell.activeNav(0);
			};
			
			var onDataLoaded = function () {
				mex.shell.hideLoading();

				//self.scroller = new iScroll('news_content');
				if (self.scroller) {
					self.scroller.refresh();
				} else {
					createScroller();
				}
			}

			var initNews = function () {
				var nav = mex.shell.curNav,
				codeType = nav.data && nav.data.codeType || "xxyw",
				grid = $("#news_ul").datagrid({
						url : "http://61.129.42.57:9080/fudan/sid/newsService/vid/index",
						type : "POST",
						data : {
							codeType : codeType
						},
						caching:false,
						linkUrl : "detail.html",
						dataType : "jsonp"

					});
				
				self.grid = grid;
				
				self.grid.datagrid("refresh",{success : onDataLoaded});
				
				//listen to the navigation event from shell
				mex.shell.onNav(refNews);	
			};

			$('#news_page').live('pagebeforecreate',function (e) {
				if (!mex.shell.hasNav()) addNavs();
			});

			$("#news_page").live("pageshow", function (e) {
				$(e.target).attr('title',mex.shell.curNav.title);

				if(self.grid)
					return;
				
				mex.shell.showLoading();

				//because the device ready is later than the pageshow,so we get data until the device is ready
				//mex.device.ready(initNews);
				initNews();

				//mex.device.simulateReady();

			});
			//when the news page has been removed ,remove the event listeners
			$("#news_page").live("pageremove", function (event) {
				self.scroller.destroy();
				self.scroller = null;
				
				mex.shell.unNav(refNews);
			});
			
		};

	});

	define('news/detail_page',function(require,exports,module){
		var mex = require('mex'),
			logger = require('mex/log').getLogger(),
			utility = require('mex/utility'),
			config = require('config'),
			$ = config.jQuery,
			window = config.window;

		exports.run = function detail_page() {
			var self={};

			$('#detail_page').live("pagebeforecreate", function (e) {
				showStatic();
			});

			var showStatic = function () {
				var grid = $('#news_ul').jqmData('datagrid');
				var current = grid.selectedItem.data;//$("#news_ul").jqmData("current_item");
				
				if (!current)
					return;
				
				var title = current.titleNews,
					page = $('#detail_page');

				page.attr('title',title);
				
				var author = current.author || "",
				time = current.time || "";

				self.idNews = current.idNews;

				page.find('h3').html(current.titleNews);
				page.find('h6').html(current.from);
			};

			function showImg (img,url,width,height) {
				img.click(function () {
					var pop = $('#detail_pop'),
						pimg = $("<img cs-src='"+url+"' width='"+width+"' height='"+height+"' />");

					utility.loadImg(pimg[0],
						{	defaultUrl:'css/images/default.png',
							width:width,
							height:height,
							loading:function(){
								pop.css('display','');
								pop.popup('open',{positionTo:$('#detail_content'),transition:'pop'});
							}
						});

					pop.append(pimg);

					// img.bind('load',function () {
					// 	pop.css('display','');

					// 	pop.popup('open',{positionTo:$('#detail_content'),transition:'pop'});
					// });
				});
			}

			$('#detail_page').live('pageshow',function (e) {

				mex.shell.showLoading();

				var baseUrl = 'http://61.129.42.57:9080/fudan',
					url = baseUrl+'/sid/newsService/vid/newsDetail?idNews='+self.idNews+'&width='+$(window).width()+'&height='+$(window).height(),
					page = e.target;

				if(self.idNews){
					$.ajax({url:url,
						type:'GET',
						dataType:'jsonp',
						success:function (data) {

							mex.shell.hideLoading();

							var news = data.jsonp.data.data.news,
										imgs = data.jsonp.data.data.imgList,
										content = $('#detail_info');

							if(imgs&&imgs.length){
								var imgsContainer = $('<div></div>');

								for(var i=0;i<imgs.length;i++){
									var img = imgs[i],
										$img = $("<img style='float:right;clear:right;margin:2px;' "+
											"width=80 height=70 cs-baseUrl='"+baseUrl+"' cs-url='"+img.path+"' />");

									utility.loadImg($img[0],{defaultUrl:'css/images/default.png'});

									imgsContainer.append($img);

									var url = baseUrl+img.path;

									showImg($img,url,img.width,img.height);
								}

								content.append(imgsContainer);
							}

							if(news){
								content.append(news.content);
							}
							var useTransform = config.platform.android?true:false

							logger.logInfo('the platform is:',config.platform,'iscorll use transform:'+useTransform);

							self.scroller = new iScroll('detail_content',{useTransform : useTransform});
						}});
				}

				$('#detail_pop').bind({
					popupafterclose:function (e,ui) {
						$(this).find('img').remove();
						$(this).css('display','none');
					}
				});
			});
	
			$('#detail_page').live('pageremove',function(e){
				if(self.scroller){
					self.scroller.destroy();
					self.scroller = null;
				}
			});

		};
	});

	var main = require('news/main');
	main.run();


})(jQuery,window,document);


