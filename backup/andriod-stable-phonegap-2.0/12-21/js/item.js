load_item(1);

function load_item(obj){

  if( obj == 1 ){
    var page = 1;
    $('#scroller').css('height','1073px');
    req_item(page);
    console.log(obj);
  }
  else{
    var page = $('#pullUp').attr('name');
    var height = $('scroller').css('height');
    $('#scroller').css('height', height + 1026 + 'px');
    req_item(page);
  }

  function req_item(page){
    var keyword = localStorage.getItem('keyword');
    console.log(keyword);
    $.ajax({
      url : 'http://topdemo.sinaapp.com/',
      dataType : 'jsonp',
      data: 'pageReq='+ page + '&apiName=getItemList' +'&keyword='+keyword,
      jsonp : 'jsonp_callback',
      success : function(m){
        console.log(m[1]);
        var content = new Array();
        for ( var i = 0 ; i < 12 ; i = i + 4 ){
          for ( var x = 0 ; x < 4 ; x++ ){
              content[i+x] = "<div class='item' title='"+ m[i+x].num_iid +"'  onclick='item_detail(this);'>"+
                "<p id='item"+ m[i+x].num_iid +"' style='display: none;'>"+  m[i+x].click_url +"</p>"+
                "<img src='"+ m[i+x].pic_url +'_200x200.jpg' +"' />"+
                "<p class='item-des'>"+ m[i+x].title +"</p>"+
                "<p class='item-function'><span class='price'>$价格："+ m[i+x].price +"</span><span class='like'>❤喜欢："+ m[i+x].volume +"</span></p>"+
              "</div>"
          }
          $('#thelist').append("<li>"+ content[i] + content[i+1] + content[i+2] + content[i+3] +"</li>");
        }
        $('#pullUp').attr('name', page+1 );
        if(page == 1 ){
          //return loaded();
          return pullUpAction();
        }
      }
    });
  }
}

function item_detail(obj){
  var link_url = $('#item'+ obj.title).html();
  sessionStorage.setItem('link_url', link_url);
  sessionStorage.setItem('item_id', obj.title);
  console.log('link_url:' + link_url + ', item_id:' + obj.title);
  window.location='swipe.html';
}
