$(function() {
    
    //ジャンプのスクロール機能-----------------------------------------------   
const isMobile = window.innerWidth <= 768; // 好きなブレークポイントでOK

const scrollDistance = isMobile ? 150 : 105; 


    $('.jump').on('click', function(e) {
        e.preventDefault();
        
        const target = $(this).attr('href');
        let pos = $(target).offset().top - scrollDistance ; //const禁止

        if (target === '#footer') {
            pos += 120;
        } else if (target === '#top') {
            pos = 0;
        }


        $('html, body').animate({scrollTop: pos}, 300);

    });

    //トップへ戻るボタン-----------------------------------------------
    $(window).on('scroll', function() {
        const scroll = $(this).scrollTop();

        if (scroll > 300) {
            $('.to_top').fadeIn();
        } else {
            $('.to_top').fadeOut();
        }
    });


  
});