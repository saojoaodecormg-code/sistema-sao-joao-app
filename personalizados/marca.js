(function(){function por(){document.querySelectorAll('.top .wrap,.login-top .wrap').forEach(function(w){if(w.querySelector('.marca-logo'))return;var i=new Image();i.src='logo-personalizados.png';i.alt='São João Personalizados';i.className='marca-logo';
 var back=w.querySelector('#bVoltar');if(back)back.after(i);else w.insertBefore(i,w.firstChild)})}
 var app=document.getElementById('app');new MutationObserver(por).observe(app,{childList:true});por()})();
