const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = document.querySelectorAll(".reveal");
const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist = true) {
  const nextTheme = theme === "light" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  themeToggle.setAttribute(
    "aria-label",
    nextTheme === "light" ? "Switch to dark mode" : "Switch to light mode"
  );
  themeColor.setAttribute("content", nextTheme === "light" ? "#f5f7fb" : "#080b14");

  if (persist) {
    try {
      window.localStorage.setItem("cognisphere-theme", nextTheme);
    } catch {
      // The selected theme still applies for the current page.
    }
  }
}

applyTheme(root.dataset.theme, false);

themeToggle.addEventListener("click", () => {
  applyTheme(root.dataset.theme === "light" ? "dark" : "light");
});

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
    if (item.dataset.revealDelay) {
      item.style.setProperty("--reveal-delay", `${item.dataset.revealDelay}ms`);
    } else {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    }
    observer.observe(item);
  });
}

const year = document.getElementById("year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const testimonialStage = document.querySelector("[data-testimonial-stage]");
if (testimonialStage) {
  const slots = [...testimonialStage.querySelectorAll(".testimonial-slot")];
  const orbitSlots = ["a", "b", "c", "d"];
  const stackQuery = window.matchMedia("(max-width: 900px)");
  let activeIndex = 0;
  let settleTimer;

  // Absolutely positioned slots contribute no height, so the stage is sized
  // from whichever card is currently featured.
  function syncStageHeight() {
    if (stackQuery.matches) {
      testimonialStage.style.removeProperty("height");
      return;
    }

    const featured = slots[activeIndex].querySelector(".testimonial-card");
    testimonialStage.style.height = `${featured.offsetHeight + 120}px`;
  }

  function setActiveTestimonial(index) {
    activeIndex = index;
    let orbit = 0;

    slots.forEach((slot, slotIndex) => {
      const isActive = slotIndex === index;

      slot.dataset.slot = isActive ? "center" : orbitSlots[orbit++];
      slot.querySelector(".testimonial-card").classList.toggle("testimonial-feature", isActive);
      slot.querySelector(".testimonial-pick").disabled = isActive;
    });

    // The first measurement lands mid-transition while the slot is still
    // resizing, so re-measure once the width has settled.
    syncStageHeight();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(syncStageHeight, 680);
  }

  slots.forEach((slot, index) => {
    const pick = document.createElement("button");
    const label = document.createElement("span");
    label.textContent = `Feature the quote from ${slot.dataset.name}`;
    pick.type = "button";
    pick.className = "testimonial-pick";
    pick.append(label);
    pick.addEventListener("click", () => setActiveTestimonial(index));
    slot.append(pick);
  });

  setActiveTestimonial(0);
  window.addEventListener("resize", syncStageHeight);
  window.addEventListener("load", syncStageHeight);
}

// Bridges the measured single-seat benchmark to a modelled company-scale ceiling.
// Every constant below is either measured in the 100-run benchmark or stated as an
// assumption in the copy next to the control, so the projection stays auditable.
const scalePeople = document.getElementById("scale-people");
if (scalePeople) {
  const MEASURED_BASELINE = 322631;
  const MEASURED_AGENT_RUN = 167768;
  const MODELLED_RECALL = 28000;
  const OVERLAP_CEILING = 0.97;
  const OVERLAP_SATURATION = 60;
  const ANSWERS_PER_SURFACE_YEAR = 300;
  const MAX_PEOPLE = 5000;
  const FLOOR_MULTIPLIER = 1.9;
  const CEILING_MULTIPLIER = 10;

  const scaleSurfaces = document.getElementById("scale-surfaces");
  const peopleValue = document.getElementById("scale-people-value");
  const surfacesValue = document.getElementById("scale-surfaces-value");
  const multiplierValue = document.querySelector("[data-scale-multiplier]");
  const reachValue = document.querySelector("[data-scale-reach]");
  const overlapValue = document.querySelector("[data-scale-overlap]");
  const tokensValue = document.querySelector("[data-scale-tokens]");
  const costValue = document.querySelector("[data-scale-cost]");
  const gauge = document.querySelector("[data-scale-gauge]");
  const presets = [...document.querySelectorAll("[data-scale-preset]")];

  // The people slider is exponential so a single control spans 1 to 5,000 usefully.
  function snap(count) {
    if (count <= 10) {
      return count;
    }

    const magnitude = 10 ** (Math.floor(Math.log10(count)) - 1);
    return Math.round(count / magnitude) * magnitude;
  }

  function peopleFromSlider(position) {
    return snap(Math.round(Math.exp((Math.log(MAX_PEOPLE) * position) / 100)));
  }

  function sliderFromPeople(count) {
    return Math.round((Math.log(count) / Math.log(MAX_PEOPLE)) * 100);
  }

  function formatCompact(value) {
    const units = [
      [1e12, "T"],
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];

    for (const [size, suffix] of units) {
      if (value >= size) {
        const scaled = value / size;
        return `${scaled.toFixed(scaled >= 100 ? 0 : 1)}${suffix}`;
      }
    }

    return Math.round(value).toLocaleString("en-US");
  }

  function render() {
    const people = peopleFromSlider(Number(scalePeople.value));
    const surfaces = Number(scaleSurfaces.value);
    const reach = people * surfaces;

    // Overlap is the chance a question has already been answered somewhere in the
    // fabric. It rises with reach and saturates, which is what caps the multiplier.
    const overlap = OVERLAP_CEILING * (1 - Math.exp(-reach / OVERLAP_SATURATION));
    const costPerAnswer = overlap * MODELLED_RECALL + (1 - overlap) * MEASURED_AGENT_RUN;
    const multiplier = MEASURED_BASELINE / costPerAnswer;
    const answers = reach * ANSWERS_PER_SURFACE_YEAR;
    const tokensAvoided = answers * (MEASURED_BASELINE - costPerAnswer);
    const fill =
      ((multiplier - FLOOR_MULTIPLIER) / (CEILING_MULTIPLIER - FLOOR_MULTIPLIER)) * 100;

    peopleValue.textContent = people.toLocaleString("en-US");
    surfacesValue.textContent = surfaces;
    reachValue.textContent = reach.toLocaleString("en-US");
    overlapValue.textContent = `${(overlap * 100).toFixed(1)}%`;
    multiplierValue.textContent = multiplier.toFixed(1);
    tokensValue.textContent = formatCompact(tokensAvoided);
    costValue.textContent = Math.round(costPerAnswer).toLocaleString("en-US");
    gauge.style.setProperty("--scale-fill", `${Math.min(Math.max(fill, 0), 100)}%`);

    presets.forEach((preset) => {
      const [presetPeople, presetSurfaces] = preset.dataset.scalePreset.split(",").map(Number);
      const matches = presetPeople === people && presetSurfaces === surfaces;

      preset.setAttribute("aria-pressed", String(matches));
    });
  }

  presets.forEach((preset) => {
    preset.setAttribute("aria-pressed", "false");
    preset.addEventListener("click", () => {
      const [presetPeople, presetSurfaces] = preset.dataset.scalePreset.split(",").map(Number);

      scalePeople.value = String(sliderFromPeople(presetPeople));
      scaleSurfaces.value = String(presetSurfaces);
      render();
    });
  });

  scalePeople.addEventListener("input", render);
  scaleSurfaces.addEventListener("input", render);
  render();
}

const journeyButton = document.getElementById("run-journey");
const journeyStage = document.querySelector(".journey-stage");
const journeySteps = [...document.querySelectorAll("[data-journey-step]")];
const journeyScenes = [...document.querySelectorAll("[data-journey-scene]")];
const sourceResult = document.querySelector('[data-journey-result="source"]');
const memoryResult = document.querySelector('[data-journey-result="memory"]');
let journeyTimer;

function setJourneyStep(step) {
  journeyStage.dataset.journeyPhase = String(step);
  journeySteps.forEach((item, index) => {
    item.classList.toggle("active", index <= step);
    item.classList.toggle("current", index === step);
  });
  journeyScenes.forEach((item) => {
    const scene = Number(item.dataset.journeyScene);
    item.classList.toggle("is-revealed", scene <= step);
    item.classList.toggle("is-current", scene === step);
  });
  sourceResult.classList.toggle("is-active", step >= 2);
  memoryResult.classList.toggle("is-active", step >= journeySteps.length - 1);
}

function runJourney() {
  window.clearInterval(journeyTimer);
  let step = 0;
  journeyButton.classList.add("running");
  journeyStage.classList.add("is-running");
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
const cognitionStory = document.querySelector(".hero-learning-map");

function replayCognitionStory() {
  cognitionStory.classList.remove("story-active");
  void cognitionStory.getBoundingClientRect();
  cognitionStory.classList.add("story-active");

  const storySvg = cognitionStory.querySelector("svg");
  if (storySvg && typeof storySvg.setCurrentTime === "function") {
    storySvg.setCurrentTime(0);
  }
}

if (cognitionStory && !reducedMotion) {
  cognitionStory.addEventListener("click", replayCognitionStory);
  cognitionStory.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      replayCognitionStory();
    }
  });
}

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
