const kell = document.getElementById('kell');

function tiksu() {
  kell.textContent = new Date().toLocaleTimeString('et-EE');
}

tiksu();
setInterval(tiksu, 1000);
