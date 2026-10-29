/* © 2026, Rommina Dolorier todos los derechos reservados.
Uso personal y educativo permitido. No comercializar ni redistribuir sin permiso.
"Creado para OFF, Chelas y código creativo"
*/

// VARIABLES PARA EXPERIMENTAR
const TEXTO_INICIAL = 'Hola';
const TRACKING = -40; // Espacio adicional entre letras en píxeles (negativo junta las letras).
const ARCHIVO_FUENTE = 'assets/ABCCameraRoundedSuperfamilyVariableTrial.ttf';
const RADIO_MOUSE = 260;
const FUERZA_MOUSE = 4.85;
const RESORTE = 0.085;
const FRICCION = 0.78;
const GROSOR_CONTORNO = 5.5;
const TAMANO_PUNTO = 12;
const DISTANCIA_PUNTOS = 108;

let tipografia, campoTexto, lienzo;
let contornos = [];
let puntero = { x: 0, y: 0, activo: false };
let agarre = null;

function preload() {
  tipografia = loadFont(ARCHIVO_FUENTE);
}

function setup() {
  lienzo = createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  campoTexto = createInput(TEXTO_INICIAL);
  campoTexto.attribute('aria-label', 'Text to deform');
  campoTexto.attribute('placeholder', 'Type something…');
  campoTexto.attribute('maxlength', '80');
  campoTexto.attribute('spellcheck', 'false');
  campoTexto.input(crearContornos);
  //const ayuda = createP('Move to stretch · drag to pull · release to relax');
  //ayuda.addClass('instructions');

  const canvas = lienzo.elt;
  canvas.addEventListener('pointermove', evento => {
    actualizarPuntero(evento);
  });
  canvas.addEventListener('pointerdown', evento => {
    actualizarPuntero(evento);
    let cercano = null, distancia = RADIO_MOUSE;
    for (const contorno of contornos) {
      for (const punto of contorno) {
        const d = Math.hypot(punto.x - puntero.x, punto.y - puntero.y);
        if (d < distancia) { cercano = punto; distancia = d; }
      }
    }
    if (cercano) {
      agarre = { x: cercano.ox, y: cercano.oy,
        inicioX: puntero.x, inicioY: puntero.y };
      canvas.setPointerCapture(evento.pointerId);
    }
  });
  canvas.addEventListener('pointerup', () => { agarre = null; });
  canvas.addEventListener('pointercancel', desactivarPuntero);
  canvas.addEventListener('pointerleave', () => {
    if (!agarre) puntero.activo = false;
  });
  window.addEventListener('blur', desactivarPuntero);
  crearContornos();
}

function actualizarPuntero(evento) {
  const rect = lienzo.elt.getBoundingClientRect();
  puntero.x = (evento.clientX - rect.left) * width / rect.width;
  puntero.y = (evento.clientY - rect.top) * height / rect.height;
  puntero.activo = true;
}

function desactivarPuntero() {
  agarre = null;
  puntero.activo = false;
}

function crearContornos() {
  contornos = [];
  agarre = null;
  const texto = campoTexto.value();
  if (!texto.trim()) return;

  // OpenType proporciona curvas separadas para cada contorno y hueco.
  const fuente = tipografia.font;
  function crearPath(tamano) {
    const path = fuente.getPath('', 0, 0, tamano);
    const glifos = fuente.stringToGlyphs(texto);
    const escalaFuente = tamano / fuente.unitsPerEm;
    let avance = 0;
    glifos.forEach((glifo, i) => {
      path.commands.push(...glifo.getPath(avance, 0, tamano).commands);
      avance += (glifo.advanceWidth || 0) * escalaFuente;
      if (i < glifos.length - 1) {
        avance += fuente.getKerningValue(glifo, glifos[i + 1]) * escalaFuente + TRACKING;
      }
    });
    return path;
  }
  const base = crearPath(300);
  const caja = base.getBoundingBox();
  const margen = Math.max(28, width * 0.075);
  const arriba = Math.min(160, height * 0.3);
  const disponibleH = Math.max(30, height - arriba - 70);
  const escala = Math.min((width - margen * 2) / Math.max(1, caja.x2 - caja.x1),
    disponibleH / Math.max(1, caja.y2 - caja.y1), 1.8);
  const tamano = 300 * escala;
  const path = crearPath(tamano);
  const limites = path.getBoundingBox();
  const x = (width - (limites.x2 - limites.x1)) / 2 - limites.x1;
  const y = arriba + (disponibleH - (limites.y2 - limites.y1)) / 2 - limites.y1;
  const comandos = path.commands.map(c => {
    const comando = { ...c };
    for (const clave of ['x', 'x1', 'x2']) if (clave in comando) comando[clave] += x;
    for (const clave of ['y', 'y1', 'y2']) if (clave in comando) comando[clave] += y;
    return comando;
  });
  let contorno = [], actual, inicio;

  function agregar(px, py) {
    contorno.push({ x: px, y: py, ox: px, oy: py, vx: 0, vy: 0, visible: false });
  }
  function terminar() {
    if (contorno.length > 2) {
      let recorrido = DISTANCIA_PUNTOS;
      contorno.forEach((p, i) => {
        if (i) recorrido += Math.hypot(p.ox - contorno[i - 1].ox, p.oy - contorno[i - 1].oy);
        if (recorrido >= DISTANCIA_PUNTOS) { p.visible = true; recorrido = 0; }
      });
      contornos.push(contorno);
    }
    contorno = [];
  }
  for (const c of comandos) {
    if (c.type === 'M') {
      terminar();
      actual = { x: c.x, y: c.y }; inicio = actual;
      agregar(c.x, c.y);
    } else if (c.type === 'Z') {
      // Sample the closing segment too, so straight edges also deform.
      segmento({ type: 'L', x: inicio.x, y: inicio.y });
      terminar();
    } else segmento(c);
  }
  terminar();

  function segmento(c) {
    const desde = actual;
    const controles = [desde];
    if (c.type === 'C' || c.type === 'Q') controles.push({ x: c.x1, y: c.y1 });
    if (c.type === 'C') controles.push({ x: c.x2, y: c.y2 });
    controles.push({ x: c.x, y: c.y });
    let longitud = 0;
    for (let i = 1; i < controles.length; i++)
      longitud += Math.hypot(controles[i].x - controles[i - 1].x, controles[i].y - controles[i - 1].y);
    const pasos = Math.max(1, Math.ceil(longitud / 5));
    for (let i = 1; i <= pasos; i++) {
      const t = i / pasos, u = 1 - t;
      if (c.type === 'C') agregar(
        u*u*u*desde.x + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x,
        u*u*u*desde.y + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y);
      else if (c.type === 'Q') agregar(
        u*u*desde.x + 2*u*t*c.x1 + t*t*c.x,
        u*u*desde.y + 2*u*t*c.y1 + t*t*c.y);
      else agregar(desde.x + (c.x - desde.x)*t, desde.y + (c.y - desde.y)*t);
    }
    actual = { x: c.x, y: c.y };
  }
}

function draw() {
  background(255);
  // Substeps keep the springs stable even when the frame rate drops.
  const dt = Math.min(deltaTime / (1000 / 60), 3);
  const pasos = Math.max(1, Math.ceil(dt));
  const paso = dt / pasos;
  for (let i = 0; i < pasos; i++) {
    for (const contorno of contornos) for (const p of contorno) {
      let destinoX = p.ox, destinoY = p.oy;
      if (puntero.activo) {
        const centro = agarre || puntero;
        const distancia = Math.hypot(p.ox - centro.x, p.oy - centro.y);
        if (distancia < RADIO_MOUSE) {
          const peso = Math.pow(1 - distancia / RADIO_MOUSE, 2);
          destinoX += (agarre ? puntero.x - agarre.inicioX : puntero.x - p.ox) * peso * FUERZA_MOUSE;
          destinoY += (agarre ? puntero.y - agarre.inicioY : puntero.y - p.oy) * peso * FUERZA_MOUSE;
        }
      }
      p.vx = (p.vx + (destinoX - p.x) * RESORTE * paso) * Math.pow(FRICCION, paso);
      p.vy = (p.vy + (destinoY - p.y) * RESORTE * paso) * Math.pow(FRICCION, paso);
      p.x += p.vx * paso; p.y += p.vy * paso;
    }
  }
  stroke(0); strokeWeight(GROSOR_CONTORNO); strokeJoin(ROUND); noFill();
  for (const contorno of contornos) {
    beginShape();
    for (const p of contorno) vertex(p.x, p.y);
    endShape(CLOSE);
  }
  noStroke(); fill(0);
  for (const contorno of contornos) for (const p of contorno)
    if (p.visible) circle(p.x, p.y, TAMANO_PUNTO);

  if (puntero.activo) {
    noFill(); stroke(0); strokeWeight(1.5);
    circle(puntero.x, puntero.y, 56);
    const { x, y } = puntero;
    line(x - 17, y, x - 5, y); line(x + 5, y, x + 17, y);
    line(x, y - 17, x, y - 5); line(x, y + 5, x, y + 17);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  crearContornos();
}
