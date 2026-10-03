// Provided from https://observablehq.com/@mbostock/scrubber 
function Scrubber(values, {
  format = value => value,
  initial = 0,
  direction = 1,
  delay = null,
  autoplay = true,
  loop = true,
  loopDelay = null,
  alternate = false
} = {}) {
  values = Array.from(values);
  // converted from observable html to raw
  const form = document.createElement("form")
  form.style.font = "12px sans-serif"
  form.style.fontVariantNumeric = "tabular-nums"
  form.style.display = "flex"
  form.style.height = "33px"
  form.style.alignItems = "center"
  form.style.width = "100%"

  const button = document.createElement("button")
  button.type = "Button"
  button.textContent = "Play"
  button.style.marginRight = "0.4em"
  button.style.width = "5em"
  form.appendChild(button)

  const label = document.createElement("label")
  label.style.display = "flex"
  label.style.alignItems = "center"
  label.style.flex="1"
  form.appendChild(label)

  const input = document.createElement("input")
  input.type = "range"
  input.min = 0;
  input.max = values.length - 1
  input.value = initial
  input.step = 1
  input.style.width = "100%"
  label.appendChild(input)

  const output = document.createElement("output")
  output.style.marginLeft = "0.4em"
  label.appendChild(output)

  form.i = input
  form.o = output
  form.b = button

  let frame = null;
  let timer = null;
  let interval = null;
  function start() {
    form.b.textContent = "Pause";
    if (delay === null) frame = requestAnimationFrame(tick);
    else interval = setInterval(tick, delay);
  }
  function stop() {
    form.b.textContent = "Play";
    if (frame !== null) cancelAnimationFrame(frame), frame = null;
    if (timer !== null) clearTimeout(timer), timer = null;
    if (interval !== null) clearInterval(interval), interval = null;
  }
  function running() {
    return frame !== null || timer !== null || interval !== null;
  }
  function tick() {
    if (form.i.valueAsNumber === (direction > 0 ? values.length - 1 : direction < 0 ? 0 : NaN)) {
      if (!loop) return stop();
      if (alternate) direction = -direction;
      if (loopDelay !== null) {
        if (frame !== null) cancelAnimationFrame(frame), frame = null;
        if (interval !== null) clearInterval(interval), interval = null;
        timer = setTimeout(() => (step(), start()), loopDelay);
        return;
      }
    }
    if (delay === null) frame = requestAnimationFrame(tick);
    step();
  }
  function step() {
    form.i.valueAsNumber = (form.i.valueAsNumber + direction + values.length) % values.length;
    form.i.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }
  form.i.oninput = event => {
    if (event && event.isTrusted && running()) stop();
    form.value = values[form.i.valueAsNumber];
    form.o.value = format(form.value, form.i.valueAsNumber, values);
  };
  form.b.onclick = () => {
    if (running()) return stop();
    direction = alternate && form.i.valueAsNumber === values.length - 1 ? -1 : 1;
    form.i.valueAsNumber = (form.i.valueAsNumber + direction) % values.length;
    form.i.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    start();
  };
  form.i.oninput();
  if (autoplay) start();
  else stop();
  return form;
}