window.addEventListener("load", () => {
  /** @type {import("three")} */
  const THREE = window.THREE;

  const { lerp, inverseLerp } = THREE.MathUtils;

  document.querySelectorAll("canvas").forEach((canvas) => {
    if (!("input" in canvas.dataset)) {
      return;
    }
    const value = { x: 0, y: 0 };

    canvas.style.border = "solid";
    canvas.style.boxSizing = "border-box";

    if ("min" in canvas.dataset) {
      canvas.dataset.minX = canvas.dataset.minY = canvas.dataset.min;
      delete canvas.dataset.min;
    }
    if ("max" in canvas.dataset) {
      canvas.dataset.maxX = canvas.dataset.maxY = canvas.dataset.max;
      delete canvas.dataset.max;
    }

    canvas.dataset.fillStyle = canvas.dataset.fillStyle ?? "black";
    canvas.dataset.radius = canvas.dataset.radius ?? 5;

    canvas.dataset.minX = canvas.dataset.minX ?? 0;
    canvas.dataset.maxX = canvas.dataset.maxX ?? 1;

    canvas.dataset.minY = canvas.dataset.minY ?? 0;
    canvas.dataset.maxY = canvas.dataset.maxY ?? 1;

    canvas.dataset.valueX = canvas.dataset.valueX ?? 0;
    canvas.dataset.valueY = canvas.dataset.valueY ?? 0;

    const lerpValue = ({ x, y }) => {
      return {
        x: lerp(canvas.dataset.minX, canvas.dataset.maxX, x),
        y: lerp(canvas.dataset.minY, canvas.dataset.maxY, y),
      };
    };
    const inverseLerpValue = ({ x, y }) => {
      return {
        x: inverseLerp(canvas.dataset.minX, canvas.dataset.maxX, x),
        y: inverseLerp(canvas.dataset.minY, canvas.dataset.maxY, y),
      };
    };

    const context = canvas.getContext("2d");
    const draw = () => {
      context.fillStyle = canvas.dataset.fillStyle;

      context.clearRect(0, 0, canvas.width, canvas.height);
      const { x, y } = inverseLerpValue(value);
      //console.log(value, { x, y });
      context.beginPath();
      context.arc(
        canvas.width * x,
        canvas.height * (1 - y),
        canvas.dataset.radius,
        0,
        2 * Math.PI
      );
      context.fill();
    };
    draw();

    Object.defineProperty(canvas, "value", {
      get() {
        return value;
      },
      set(newValue) {
        value.x = Math.max(
          canvas.dataset.minX,
          Math.min(canvas.dataset.maxX, newValue.x)
        );
        value.y = Math.max(
          canvas.dataset.minY,
          Math.min(canvas.dataset.maxY, newValue.y)
        );

        canvas.dataset.valueX = value.x;
        canvas.dataset.valueY = value.y;

        draw();
        dispatchEvent();
        //console.log(value);
      },
      configurable: true,
      enumerable: true,
    });

    let isMouseDown = false;
    const setIsMouseDown = (newIsMouseDown) => {
      if (newIsMouseDown == isMouseDown) {
        return;
      }
      isMouseDown = newIsMouseDown;
      //console.log({ isMouseDown });
    };
    const dispatchEvent = () => {
      canvas.dispatchEvent(new CustomEvent("input", { detail: value }));
    };
    document.addEventListener("mouseup", () => {
      setIsMouseDown(false);
    });

    canvas.addEventListener("mousedown", (event) => {
      const { offsetX, offsetY } = event;
      const x = offsetX / canvas.clientWidth;
      const y = 1 - offsetY / canvas.clientHeight;
      canvas.value = lerpValue({ x, y });
      setIsMouseDown(true);
    });
    document.addEventListener("mousemove", (event) => {
      if (!isMouseDown) return;

      const rect = canvas.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const x = offsetX / rect.width;
      const y = 1 - offsetY / rect.height;

      canvas.value = lerpValue({ x, y });
    });
  });
});
