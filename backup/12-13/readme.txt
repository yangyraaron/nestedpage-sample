1. bug: when the first page is loading , the loading spinner doesn't show.
	reason:the loading code executes when the first page's beforepagecreate event is firing,
			and the first page isn't fully initialized by jquery mobile, this is due to the fact that
			the first page here is the nested page ,which is not the first page of the jquery mobile
			any more.so the pagebeforeshow, pageshow event of it will not be fired.
	code: in the shell class, when the shell page is show, then trigger the pageshow event of the first page,the first page listen to pageshow event and load the page
	status:fixed