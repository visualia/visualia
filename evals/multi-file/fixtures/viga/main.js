const tunnid = new Date().getHours();
document.getElementById('tervitus').textContent =
  tunnid < 12 ? 'Tere hommikust!' : tunnid < 18 ? 'Tere päevast!' : 'Tere õhtust!';

const aeg = document.getElementById('kell');
function tiksu() {
  aeg.textContent = new Date().toLocaleTimeString('et-EE');
}
tiksu();
setInterval(tiksu, 1000);
