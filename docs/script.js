const reducedMotion = false;
const revealItems = document.querySelectorAll(".reveal");

document.body.classList.add("is-loading");

const loader = document.querySelector(".intro-loader");
requestAnimationFrame(() => {
  window.setTimeout(() => {
    loader.classList.add("complete");
    document.body.classList.remove("is-loading");
  }, reducedMotion ? 0 : 300);
});

if (reducedMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(item);
  });
}

const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const journeyButton = document.getElementById("run-journey");
const journeySteps = [...document.querySelectorAll("[data-journey-step]")];
const sourceResult = document.querySelector('[data-journey-result="source"]');
const memoryResult = document.querySelector('[data-journey-result="memory"]');
let journeyTimer;

function setJourneyStep(step) {
  journeySteps.forEach((item, index) => {
    item.classList.toggle("active", index <= step);
  });
  sourceResult.classList.toggle("is-active", step >= 0);
  memoryResult.classList.toggle("is-active", step >= journeySteps.length - 1);
}

function runJourney() {
  window.clearInterval(journeyTimer);
  let step = 0;
  journeyButton.classList.add("running");
  journeyButton.querySelector(".journey-control-text").textContent = "Memory moving...";
  setJourneyStep(step);

  journeyTimer = window.setInterval(() => {
    step += 1;
    setJourneyStep(step);

    if (step >= journeySteps.length - 1) {
      window.clearInterval(journeyTimer);
      journeyButton.classList.remove("running");
      journeyButton.querySelector(".journey-control-icon").textContent = "↻";
      journeyButton.querySelector(".journey-control-text").textContent = "Replay the journey";
    }
  }, 700);
}

journeyButton.addEventListener("click", runJourney);

const heroOrbit = document.querySelector(".hero-orbit");

const sectionEffectsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("effects-paused", !entry.isIntersecting);
    });
  },
  { rootMargin: "200px 0px", threshold: 0 }
);

document.querySelectorAll("main > section").forEach((section) => {
  sectionEffectsObserver.observe(section);
});

if (!reducedMotion && window.matchMedia("(pointer: fine)").matches) {
  let pointerFrame;
  let pointerX = 0;
  let pointerY = 0;

  window.addEventListener(
    "pointermove",
    (event) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 10;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 10;

      if (!pointerFrame) {
        pointerFrame = requestAnimationFrame(() => {
          heroOrbit.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
          pointerFrame = undefined;
        });
      }
    },
    { passive: true }
  );
}

const canvas = document.getElementById("memory-canvas");
const context = canvas.getContext("2d");
let points = [];

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.25);
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);

  points = Array.from({ length: 24 }, (_, index) => {
    const phi = Math.acos(1 - (2 * (index + 0.5)) / 24);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    return {
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(phi)
    };
  });
}

function drawMemorySphere(time = 0) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const radius = Math.min(width, height) * 0.33;
  const centerX = width / 2;
  const centerY = height / 2;
  const rotation = time * 0.00012;
  const projected = points.map((point) => {
    const rotatedX = point.x * Math.cos(rotation) - point.z * Math.sin(rotation);
    const rotatedZ = point.x * Math.sin(rotation) + point.z * Math.cos(rotation);
    const perspective = 0.78 + (rotatedZ + 1) * 0.11;
    return {
      x: centerX + rotatedX * radius * perspective,
      y: centerY + point.y * radius * perspective,
      z: rotatedZ,
      alpha: 0.2 + (rotatedZ + 1) * 0.24
    };
  });

  context.clearRect(0, 0, width, height);

  projected.forEach((point, index) => {
    for (let otherIndex = index + 1; otherIndex < projected.length; otherIndex += 1) {
      const other = projected[otherIndex];
      const distance = Math.hypot(point.x - other.x, point.y - other.y);
      if (distance < radius * 0.62) {
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = `rgba(112, 210, 225, ${Math.max(0, 0.13 - distance / (radius * 5))})`;
        context.lineWidth = 0.7;
        context.stroke();
      }
    }
  });

  projected
    .sort((a, b) => a.z - b.z)
    .forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 1.4 + (point.z + 1) * 0.8, 0, Math.PI * 2);
      context.fillStyle = `rgba(190, 179, 255, ${point.alpha})`;
      context.fill();
    });
}

resizeCanvas();
drawMemorySphere(0);
window.addEventListener(
  "resize",
  () => {
    requestAnimationFrame(() => {
      resizeCanvas();
      drawMemorySphere(0);
    });
  },
  { passive: true }
);
