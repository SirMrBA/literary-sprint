(() => {
  "use strict";

  const STORAGE_KEY = "literary-sprint-progress-v1";
  const defaultState = {
    cards: {},
    attempts: 0,
    correct: 0,
    mistakes: {},
    plan: {},
    examHistory: []
  };

  let state = loadState();
  let cardDeck = [];
  let cardIndex = 0;
  let practice = null;
  let exam = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...defaultState, ...saved };
    } catch {
      return { ...defaultState };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateMetrics();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function sample(items, count) {
    return shuffle(items).slice(0, Math.min(count, items.length));
  }

  function showView(name) {
    $$(".view").forEach(view => view.classList.toggle("is-active", view.id === `view-${name}`));
    $$(".tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.view === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "cards") buildCardDeck();
    if (name === "home") {
      renderStudyPlan();
      updateMetrics();
    }
  }

  function updateMetrics() {
    const core = FLASHCARDS.filter(card => card.priority === 1);
    const mastered = core.filter(card => state.cards[card.id] === "good").length;
    $("#metric-mastered").textContent = `${mastered} / ${core.length}`;
    $("#metric-accuracy").textContent = state.attempts ? `${Math.round((state.correct / state.attempts) * 100)}%` : "—";
    $("#metric-mistakes").textContent = Object.keys(state.mistakes).length;
  }

  function renderStudyPlan() {
    const host = $("#study-plan");
    host.innerHTML = "";
    STUDY_PLAN.forEach(item => {
      const row = document.createElement("label");
      row.className = `plan-item${state.plan[item.id] ? " is-done" : ""}`;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = Boolean(state.plan[item.id]);
      check.addEventListener("change", () => {
        state.plan[item.id] = check.checked;
        saveState();
        renderStudyPlan();
      });

      const time = document.createElement("span");
      time.className = "plan-time";
      time.textContent = item.time;

      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const detail = document.createElement("p");
      detail.textContent = item.detail;
      copy.append(title, detail);

      let action;
      if (item.action === "Pause") {
        action = document.createElement("span");
        action.className = "plan-action";
        action.textContent = "Pause";
      } else {
        action = document.createElement("button");
        action.type = "button";
        action.className = "button ghost";
        action.textContent = item.action;
        action.addEventListener("click", event => {
          event.preventDefault();
          if (item.id === "diagnostic") {
            startDiagnostic();
          } else if (item.id === "mock") {
            showView("exam");
          } else if (item.id === "mistakes") {
            $("#practice-category").value = "Mistakes";
            showView("practice");
          } else {
            $("#card-category").value = item.id === "narrative" ? "Narrative" : item.id === "poetry" ? "Poetry" : "Drama";
            $("#card-priority").value = "core";
            showView("cards");
          }
        });
      }
      row.append(check, time, copy, action);
      host.append(row);
    });
  }

  function buildCardDeck(forceShuffle = false) {
    const category = $("#card-category").value;
    const set = $("#card-priority").value;
    let filtered = FLASHCARDS.filter(card => category === "All" || card.category === category);
    if (set === "core") filtered = filtered.filter(card => card.priority === 1);
    if (set === "mistakes") filtered = filtered.filter(card => ["again", "hard"].includes(state.cards[card.id]));

    if (!filtered.length) {
      filtered = FLASHCARDS.filter(card => (category === "All" || card.category === category) && card.priority === 1);
      $("#card-priority").value = "core";
    }

    const currentIds = cardDeck.map(card => card.id).join("|");
    const newIds = filtered.map(card => card.id).join("|");
    if (forceShuffle || currentIds !== newIds || !cardDeck.length) {
      cardDeck = shuffle(filtered);
      cardIndex = 0;
    }
    showCard();
  }

  function showCard() {
    const card = cardDeck[cardIndex];
    if (!card) return;
    $("#card-back").classList.add("is-hidden");
    $("#card-front").classList.remove("is-hidden");
    $("#card-category-label").textContent = card.category;
    $("#card-counter").textContent = `${cardIndex + 1} / ${cardDeck.length}`;
    $("#card-term").textContent = card.term;
    $("#card-back-term").textContent = card.term;
    $("#card-definition").textContent = card.definition;
    $("#card-cue").textContent = card.cue;
    $("#card-example").textContent = card.example;
    $("#card-trap").textContent = card.trap;
    $("#card-progress").style.width = `${((cardIndex + 1) / cardDeck.length) * 100}%`;
  }

  function rateCard(rating) {
    const card = cardDeck[cardIndex];
    state.cards[card.id] = rating;
    saveState();
    cardIndex = (cardIndex + 1) % cardDeck.length;
    if (cardIndex === 0) cardDeck = shuffle(cardDeck);
    showCard();
  }

  function questionPool(category) {
    if (category === "All") return QUESTIONS;
    if (category === "Mistakes") {
      const ids = new Set(Object.keys(state.mistakes));
      return QUESTIONS.filter(question => ids.has(question.id));
    }
    return QUESTIONS.filter(question => question.category === category);
  }

  function startDiagnostic() {
    $("#practice-category").value = "All";
    $("#practice-count").value = "15";
    showView("practice");
    startPractice(true);
  }

  function startPractice(diagnostic = false) {
    const category = diagnostic ? "All" : $("#practice-category").value;
    const count = diagnostic ? 15 : Number($("#practice-count").value);
    const pool = questionPool(category);

    if (!pool.length) {
      $("#practice-start").innerHTML = "<p>No saved mistakes yet. Complete a mixed practice or mock exam first.</p><button id='fallback-practice' class='button primary'>Start mixed practice</button>";
      $("#fallback-practice").addEventListener("click", () => {
        $("#practice-category").value = "All";
        startPractice();
      });
      return;
    }

    practice = {
      questions: sample(pool, count),
      index: 0,
      selected: null,
      score: 0,
      answers: [],
      checked: false
    };
    $("#practice-start").classList.add("is-hidden");
    $("#practice-session").classList.remove("is-hidden");
    renderPracticeQuestion();
  }

  function optionMarkup(question, selected, reveal = false) {
    return question.options.map((option, index) => {
      const classes = ["option"];
      if (index === selected) classes.push("is-selected");
      if (reveal && index === question.answer) classes.push("is-correct");
      if (reveal && index === selected && selected !== question.answer) classes.push("is-wrong");
      return `
        <button type="button" class="${classes.join(" ")}" data-option="${index}" ${reveal ? "disabled" : ""}>
          <span class="option-letter">${String.fromCharCode(65 + index)}</span>
          <span>${option}</span>
        </button>`;
    }).join("");
  }

  function renderPracticeQuestion() {
    const host = $("#practice-session");
    const question = practice.questions[practice.index];
    host.innerHTML = `
      <div class="quiz-topline">
        <span class="question-type">${question.type} · ${question.category}</span>
        <span>Question ${practice.index + 1} of ${practice.questions.length}</span>
      </div>
      <div class="progress-line"><span style="width:${((practice.index + 1) / practice.questions.length) * 100}%"></span></div>
      <div class="question-text">${question.text}</div>
      <div class="options">${optionMarkup(question, practice.selected, practice.checked)}</div>
      <div id="practice-feedback"></div>
      <div class="quiz-actions">
        <button id="practice-check" class="button primary" ${practice.selected === null || practice.checked ? "disabled" : ""}>Check answer</button>
        <button id="practice-next" class="button primary ${practice.checked ? "" : "is-hidden"}">${practice.index + 1 === practice.questions.length ? "See results" : "Next question"}</button>
      </div>`;

    $$(".option", host).forEach(button => button.addEventListener("click", () => {
      practice.selected = Number(button.dataset.option);
      $$(".option", host).forEach(option => option.classList.toggle("is-selected", option === button));
      $("#practice-check").disabled = false;
    }));
    $("#practice-check").addEventListener("click", checkPracticeAnswer);
    $("#practice-next").addEventListener("click", nextPracticeQuestion);

    if (practice.checked) showPracticeFeedback();
  }

  function checkPracticeAnswer() {
    if (practice.selected === null || practice.checked) return;
    const question = practice.questions[practice.index];
    const correct = practice.selected === question.answer;
    practice.checked = true;
    if (correct) practice.score += 1;
    practice.answers.push({ question, selected: practice.selected, correct });
    registerQuestionResult(question.id, correct);
    renderPracticeQuestion();
  }

  function showPracticeFeedback() {
    const answer = practice.answers[practice.answers.length - 1];
    const question = answer.question;
    $("#practice-feedback").innerHTML = `
      <div class="feedback ${answer.correct ? "correct" : "wrong"}">
        <strong>${answer.correct ? "Correct." : `Not quite. Correct answer: ${question.options[question.answer]}.`}</strong>
        <span>${question.explanation}</span>
      </div>`;
  }

  function nextPracticeQuestion() {
    if (practice.index + 1 >= practice.questions.length) {
      renderResults($("#practice-session"), practice.questions, practice.answers, "practice");
      return;
    }
    practice.index += 1;
    practice.selected = null;
    practice.checked = false;
    renderPracticeQuestion();
  }

  function registerQuestionResult(id, correct) {
    state.attempts += 1;
    if (correct) {
      state.correct += 1;
      if (state.mistakes[id]) {
        state.mistakes[id] -= 1;
        if (state.mistakes[id] <= 0) delete state.mistakes[id];
      }
    } else {
      state.mistakes[id] = (state.mistakes[id] || 0) + 1;
    }
    saveState();
  }

  function startExam() {
    const selected = shuffle([
      ...sample(QUESTIONS.filter(q => q.category === "Narrative"), 12),
      ...sample(QUESTIONS.filter(q => q.category === "Poetry"), 12),
      ...sample(QUESTIONS.filter(q => q.category === "Drama"), 6)
    ]);
    exam = { questions: selected, index: 0, selected: null, answers: [] };
    $("#exam-start").classList.add("is-hidden");
    $("#exam-session").classList.remove("is-hidden");
    renderExamQuestion();
  }

  function renderExamQuestion() {
    const host = $("#exam-session");
    const question = exam.questions[exam.index];
    host.innerHTML = `
      <div class="quiz-topline">
        <span class="question-type">${question.type} · ${question.category}</span>
        <span>Question ${exam.index + 1} of ${exam.questions.length}</span>
      </div>
      <div class="progress-line"><span style="width:${((exam.index + 1) / exam.questions.length) * 100}%"></span></div>
      <div class="question-text">${question.text}</div>
      <div class="options">${optionMarkup(question, exam.selected, false)}</div>
      <div class="quiz-actions">
        <button id="exam-next" class="button primary" disabled>${exam.index + 1 === exam.questions.length ? "Finish exam" : "Next question"}</button>
      </div>`;

    $$(".option", host).forEach(button => button.addEventListener("click", () => {
      exam.selected = Number(button.dataset.option);
      $$(".option", host).forEach(option => option.classList.toggle("is-selected", option === button));
      $("#exam-next").disabled = false;
    }));
    $("#exam-next").addEventListener("click", nextExamQuestion);
  }

  function nextExamQuestion() {
    const question = exam.questions[exam.index];
    exam.answers.push({
      question,
      selected: exam.selected,
      correct: exam.selected === question.answer
    });
    if (exam.index + 1 >= exam.questions.length) {
      exam.answers.forEach(answer => registerQuestionResult(answer.question.id, answer.correct));
      const score = exam.answers.filter(answer => answer.correct).length;
      state.examHistory.push({ date: new Date().toISOString(), score, total: exam.questions.length });
      state.examHistory = state.examHistory.slice(-8);
      saveState();
      renderResults($("#exam-session"), exam.questions, exam.answers, "exam");
      return;
    }
    exam.index += 1;
    exam.selected = null;
    renderExamQuestion();
  }

  function renderResults(host, questions, answers, mode) {
    const score = answers.filter(answer => answer.correct).length;
    const percent = Math.round((score / questions.length) * 100);
    const message = percent >= 85 ? "Strong result. Repair the few remaining mistakes." :
      percent >= 70 ? "Good direction. Review every wrong answer before the real test." :
      "Use the saved mistakes and core cards before trying again.";

    host.innerHTML = `
      <div class="result-score">
        <span class="tag">${mode === "exam" ? "Mock exam complete" : "Practice complete"}</span>
        <strong>${percent}%</strong>
        <p>${score} of ${questions.length} correct. ${message}</p>
      </div>
      <div class="review-list">
        ${answers.map((answer, index) => `
          <article class="review-item ${answer.correct ? "correct" : "wrong"}">
            <strong>${index + 1}. ${stripHtml(answer.question.text)}</strong>
            <p>Your answer: ${answer.question.options[answer.selected]} · Correct: ${answer.question.options[answer.question.answer]}</p>
            <p>${answer.question.explanation}</p>
          </article>`).join("")}
      </div>
      <div class="quiz-actions">
        <button id="result-mistakes" class="button ghost">Practice saved mistakes</button>
        <button id="result-again" class="button primary">Try again</button>
      </div>`;

    $("#result-mistakes").addEventListener("click", () => {
      $("#practice-category").value = "Mistakes";
      showView("practice");
      startPractice();
    });
    $("#result-again").addEventListener("click", () => {
      if (mode === "exam") {
        startExam();
      } else {
        $("#practice-start").classList.remove("is-hidden");
        $("#practice-session").classList.add("is-hidden");
        startPractice();
      }
    });
  }

  function stripHtml(value) {
    const temp = document.createElement("div");
    temp.innerHTML = value;
    return temp.textContent.trim();
  }

  // Navigation and controls
  $$(".tab").forEach(tab => tab.addEventListener("click", () => showView(tab.dataset.view)));
  $("#start-diagnostic").addEventListener("click", startDiagnostic);
  $("#start-practice").addEventListener("click", () => startPractice());
  $("#start-exam").addEventListener("click", startExam);
  $("#reveal-card").addEventListener("click", () => {
    $("#card-front").classList.add("is-hidden");
    $("#card-back").classList.remove("is-hidden");
  });
  $$(".rating-row [data-rating]").forEach(button => button.addEventListener("click", () => rateCard(button.dataset.rating)));
  $("#card-category").addEventListener("change", () => buildCardDeck(true));
  $("#card-priority").addEventListener("change", () => buildCardDeck(true));
  $("#shuffle-cards").addEventListener("click", () => buildCardDeck(true));
  $("#print-sheet").addEventListener("click", () => window.print());
  $("#reset-progress").addEventListener("click", () => {
    if (!window.confirm("Reset all card ratings, quiz results and saved mistakes?")) return;
    state = { ...defaultState, cards: {}, mistakes: {}, plan: {}, examHistory: [] };
    saveState();
    renderStudyPlan();
  });

  renderStudyPlan();
  updateMetrics();
  buildCardDeck(true);
})();
