// ======================== 背景图片轮播（全量预加载） ========================
(function initBackgroundSlideshow() {
  const typeKeys = ["红红火火", "翩翩起舞", "酷酷", "害羞", "鄙视", "猪猪", "紫色"];
  const imagePaths = typeKeys.map(key => `images/${key}.svg`);
  const switchInterval = 4000;
  let currentIndex = 0;

  // 预加载全部图片
  let loadedCount = 0;
  imagePaths.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loadedCount++;
      if (loadedCount === imagePaths.length) {
        // 全部加载完成后开始轮播
        setBackground(0);
        setInterval(() => {
          currentIndex = (currentIndex + 1) % imagePaths.length;
          setBackground(currentIndex);
        }, switchInterval);
      }
    };
    img.src = src;
  });

  function setBackground(index) {
    document.documentElement.style.setProperty('--bg-image', `url('${imagePaths[index]}')`);
  }
})();

// ======================== 公共工具函数（坐标计算与类型判定） ========================
function computeCoordinateFromAnswers(answers) {
  return answers.reduce((acc, ans) => {
    acc.x += ans.dx;
    acc.y += ans.dy;
    return acc;
  }, { x: -1, y: -3 });
}

function getTypeFromCoord(x, y) {
  const dist = Math.hypot(x, y);
  if (dist <= 3.0) return "猪猪";
  let angleRad = Math.atan2(y, x);
  let angleDeg = angleRad * 180 / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  let rotatedDeg = (angleDeg + 30) % 360;
  if (rotatedDeg < 60) return "翩翩起舞";
  else if (rotatedDeg < 120) return "红红火火";
  else if (rotatedDeg < 180) return "紫色";
  else if (rotatedDeg < 240) return "害羞";
  else if (rotatedDeg < 300) return "鄙视";
  else return "酷酷";
}

// ======================== 全局变量与DOM元素绑定 ========================
let currentIndex = 0;
let answers = new Array(QUESTIONS.length).fill(null);

const welcomeDiv = document.getElementById('welcomeScreen');
const quizDiv = document.getElementById('quizScreen');
const resultDiv = document.getElementById('resultScreen');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const progressFill = document.getElementById('progressFill');
const qIndexSpan = document.getElementById('qIndex');
const qTotalSpan = document.getElementById('qTotal');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

qTotalSpan.innerText = QUESTIONS.length;

// 辅助函数
function elt(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.innerText = text;
  return el;
}

// ======================== 渲染当前题目 ========================
function renderQuestion() {
  const q = QUESTIONS[currentIndex];
  questionText.innerText = `${currentIndex + 1}. ${q.text}`;
  optionsContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const optionDiv = elt('div', 'option-item');
    if (answers[currentIndex]?.dx === opt.dx && answers[currentIndex]?.dy === opt.dy) {
      optionDiv.classList.add('selected');
    }
    const prefix = elt('span', 'option-prefix', String.fromCharCode(65 + idx));
    const text = elt('span', '', opt.text);
    optionDiv.append(prefix, text);

    optionDiv.addEventListener('click', () => {
      answers[currentIndex] = { dx: opt.dx, dy: opt.dy };
      document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
      optionDiv.classList.add('selected');
      setTimeout(goNext, 100);
    });

    optionsContainer.appendChild(optionDiv);
  });
  progressFill.style.width = `${((currentIndex + 1) / QUESTIONS.length) * 100}%`;
  qIndexSpan.innerText = currentIndex + 1;
}

// ======================== 计算结果与展示 ========================
function computeResult() {
  for (let ans of answers) if (!ans) return null;
  const coord = computeCoordinateFromAnswers(answers);
  const typeKey = getTypeFromCoord(coord.x, coord.y);
  return { typeKey, ...coord };
}

function showResult() {
  const res = computeResult();
  if (!res) { alert("请完成全部题目"); return; }
  const t = TYPES[res.typeKey];
  document.getElementById('resultTypeName').innerText = t.title;
  document.getElementById('resultDescCard').innerHTML = `
    <div class="quote">${t.quote.replace(/\n/g, '<br>')}</div>
    <p>${t.description.replace(/\n/g, '<br>')}</p>
    <p style="color:#7c3aed">${t.signature}</p>
  `;

  const resultImg = document.getElementById('resultImage');
  resultImg.src = `images/${res.typeKey}.svg`;
  resultImg.alt = `${t.title} 代表图`;
  resultImg.onerror = function () {
    this.style.display = 'none';
    this.parentElement.style.display = 'none';
  };
  resultImg.onload = function () {
    this.style.display = 'block';
    this.parentElement.style.display = 'flex';
  };

  welcomeDiv.style.display = 'none';
  quizDiv.style.display = 'none';
  resultDiv.style.display = 'block';
}

// ======================== 导航函数 ========================
function goPrev() {
  if (currentIndex > 0) { currentIndex--; renderQuestion(); }
}

function goNext() {
  if (currentIndex < QUESTIONS.length - 1) { currentIndex++; renderQuestion(); }
  else showResult();
}

function resetTest() {
  answers = new Array(QUESTIONS.length).fill(null);
  currentIndex = 0;
  welcomeDiv.style.display = 'block';
  quizDiv.style.display = 'none';
  resultDiv.style.display = 'none';
}

// ======================== 事件绑定 ========================
startBtn.addEventListener('click', () => {
  resetTest();
  welcomeDiv.style.display = 'none';
  quizDiv.style.display = 'block';
  renderQuestion();
});

prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);
restartBtn.addEventListener('click', resetTest);