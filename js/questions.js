(() => {
  const D = window.ElementBattleData;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const uniq = arr => [...new Set(arr)];

  function sampleDifferent(pool, answer, count, mapFn = x => x) {
    const candidates = shuffle(pool.filter(x => mapFn(x) !== answer));
    return uniq(candidates.map(mapFn)).filter(x => x !== answer).slice(0, count);
  }

  function buildQuestion({type, prompt, answer, distractors, explanation = '', key = ''}) {
    const values = uniq([answer, ...distractors]);
    if (values.length < 4) throw new Error(`Not enough answer options for ${key || prompt}`);
    const options = shuffle(values.slice(0, 4));
    return { type, prompt, options, correctIndex: options.indexOf(answer), answer, explanation, key: key || `${type}|${prompt}|${answer}` };
  }

  function nearNumbers(answer, min = 0, max = 120) {
    const offsets = shuffle([-3,-2,-1,1,2,3,4,-4,5,-5]);
    const out = [];
    for (const d of offsets) {
      const v = answer + d;
      if (v >= min && v <= max && v !== answer && !out.includes(v)) out.push(v);
      if (out.length === 3) break;
    }
    return out.map(String);
  }

  function ionLatex(e) {
    const charge = e.commonIon;
    const sign = charge > 0 ? '+' : '-';
    const mag = Math.abs(charge) === 1 ? '' : Math.abs(charge);
    return `\\(\\mathrm{${e.symbol}^{${mag}${sign}}}\\)`;
  }

  function valenceElectrons(e) {
    if (e.symbol === 'He') return 2;
    if (e.group === 1) return 1;
    if (e.group === 2) return 2;
    if (e.group >= 13 && e.group <= 18) return e.group - 10;
    return null;
  }

  function easyQuestion() {
    const e = pick(D.easyPool);
    if (Math.random() < .5) {
      return buildQuestion({
        type:'名稱 → 符號',
        prompt:`「${e.name}」的元素符號是？`,
        answer:e.symbol,
        distractors:sampleDifferent(D.easyPool, e.symbol, 3, x => x.symbol),
        explanation:`${e.name}的元素符號是 ${e.symbol}。`, key:`easy-name-symbol-${e.symbol}`
      });
    }
    return buildQuestion({
      type:'符號 → 名稱',
      prompt:`元素符號 <strong>${e.symbol}</strong> 代表哪一種元素？`,
      answer:e.name,
      distractors:sampleDifferent(D.easyPool, e.name, 3, x => x.name),
      explanation:`${e.symbol} 代表${e.name}。`, key:`easy-symbol-name-${e.symbol}`
    });
  }

  function mediumQuestion() {
    const e = pick(D.first36);
    const kind = Math.floor(Math.random() * 6);
    if (kind === 0) {
      return buildQuestion({ type:'原子序', prompt:`${e.name}（${e.symbol}）的原子序是多少？`, answer:String(e.atomicNumber), distractors:nearNumbers(e.atomicNumber,1,40), key:`m-z-${e.symbol}` });
    }
    if (kind === 1) {
      return buildQuestion({ type:'質子數', prompt:`${e.name}原子含有幾個質子？`, answer:String(e.atomicNumber), distractors:nearNumbers(e.atomicNumber,1,40), explanation:'質子數＝原子序。', key:`m-p-${e.symbol}` });
    }
    if (kind === 2) {
      return buildQuestion({ type:'中性原子的電子數', prompt:`中性的${e.name}原子含有幾個電子？`, answer:String(e.atomicNumber), distractors:nearNumbers(e.atomicNumber,0,40), explanation:'中性原子中，電子數＝質子數＝原子序。', key:`m-e-${e.symbol}` });
    }
    if (kind === 3) {
      const neutron = e.massNumber - e.atomicNumber;
      return buildQuestion({
        type:'中子數',
        prompt:`\\(^{${e.massNumber}}_{${e.atomicNumber}}\\mathrm{${e.symbol}}\\) 的中子數是多少？`,
        answer:String(neutron), distractors:nearNumbers(neutron,0,140), explanation:'中子數＝質量數－原子序。', key:`m-n-${e.symbol}-${e.massNumber}`
      });
    }
    if (kind === 4) {
      const ans = e.shells.join(', ');
      const distractors = sampleDifferent(D.first36, ans, 3, x => x.shells.join(', '));
      return buildQuestion({ type:'電子層排列', prompt:`${e.name}（${e.symbol}）的 K、L、M、N 電子層排列何者正確？`, answer:ans, distractors, key:`m-shell-${e.symbol}` });
    }
    const candidates = D.first36.filter(x => x.shells.join(',') !== e.shells.join(','));
    return buildQuestion({
      type:'由電子層判斷元素', prompt:`某中性原子的電子排列為 <strong>${e.shells.join(', ')}</strong>，它最可能是？`,
      answer:`${e.name}（${e.symbol}）`, distractors:sampleDifferent(candidates, `${e.name}（${e.symbol}）`, 3, x => `${x.name}（${x.symbol}）`), key:`m-shell-ident-${e.symbol}`
    });
  }

  function specialConfigQuestion(symbol) {
    if (symbol === 'Cr') {
      return buildQuestion({
        type:'特殊電子組態', prompt:'鉻（Cr）的基態電子組態何者正確？',
        answer:'\\([\\mathrm{Ar}]\\,3d^5 4s^1\\)',
        distractors:['\\([\\mathrm{Ar}]\\,3d^4 4s^2\\)','\\([\\mathrm{Ar}]\\,3d^6\\)','\\([\\mathrm{Ar}]\\,3d^3 4s^3\\)'],
        explanation:'Cr 為常見例外：半滿的 3d⁵ 較穩定，因此為 [Ar] 3d⁵4s¹。', key:'h-cr-config'
      });
    }
    return buildQuestion({
      type:'特殊電子組態', prompt:'銅（Cu）的基態電子組態何者正確？',
      answer:'\\([\\mathrm{Ar}]\\,3d^{10}4s^1\\)',
      distractors:['\\([\\mathrm{Ar}]\\,3d^9 4s^2\\)','\\([\\mathrm{Ar}]\\,3d^8 4s^3\\)','\\([\\mathrm{Ar}]\\,3d^{10}4s^2\\)'],
      explanation:'Cu 為常見例外：全滿的 3d¹⁰ 較穩定，因此為 [Ar] 3d¹⁰4s¹。', key:'h-cu-config'
    });
  }

  function hardQuestion() {
    const roll = Math.random();
    if (roll < .18) return specialConfigQuestion(Math.random() < .5 ? 'Cr' : 'Cu');

    const kind = Math.floor(Math.random() * 6);
    if (kind === 0) {
      const e = pick(D.first36);
      return buildQuestion({ type:'週期', prompt:`${e.name}（${e.symbol}）位於第幾週期？`, answer:String(e.period), distractors:sampleDifferent([1,2,3,4,5,6,7], String(e.period),3,String), key:`h-period-${e.symbol}` });
    }
    if (kind === 1) {
      const e = pick(D.first36);
      return buildQuestion({ type:'族', prompt:`${e.name}（${e.symbol}）位於第幾族？`, answer:`第 ${e.group} 族`, distractors:sampleDifferent(Array.from({length:18},(_,i)=>i+1), `第 ${e.group} 族`,3,x=>`第 ${x} 族`), key:`h-group-${e.symbol}` });
    }
    if (kind === 2) {
      const e = pick(D.mainGroup);
      const v = valenceElectrons(e);
      return buildQuestion({ type:'價電子', prompt:`${e.name}（${e.symbol}）的價電子數為多少？`, answer:String(v), distractors:nearNumbers(v,1,8), key:`h-valence-${e.symbol}` });
    }
    if (kind === 3) {
      const e = pick(D.ionPool);
      const electronCount = e.atomicNumber - e.commonIon;
      return buildQuestion({ type:'離子電子數', prompt:`${ionLatex(e)} 含有幾個電子？`, answer:String(electronCount), distractors:nearNumbers(electronCount,0,40), explanation:'正離子失去電子；負離子得到電子。', key:`h-ion-${e.symbol}-${e.commonIon}` });
    }
    if (kind === 4) {
      const e = pick(D.first36);
      return buildQuestion({ type:'電子層數', prompt:`${e.name}（${e.symbol}）共有幾個主要電子層？`, answer:String(e.period), distractors:sampleDifferent([1,2,3,4,5,6], String(e.period),3,String), explanation:'主要電子層數通常對應元素所在週期。', key:`h-layercount-${e.symbol}` });
    }
    const e = pick(D.first36);
    return buildQuestion({
      type:'綜合判斷', prompt:`某中性原子的電子排列為 <strong>${e.shells.join(', ')}</strong>。下列何者正確？`,
      answer:`它的原子序是 ${e.atomicNumber}`,
      distractors:[`它位於第 ${e.period === 4 ? 3 : e.period + 1} 週期`,`它的質子數是 ${e.atomicNumber + 1}`,`它有 ${Math.max(0,e.atomicNumber-1)} 個電子`],
      explanation:'中性原子的總電子數＝原子序＝質子數。', key:`h-mixed-${e.symbol}`
    });
  }

  function generateQuestion(difficulty, recentKeys = []) {
    const maker = difficulty === 'easy' ? easyQuestion : difficulty === 'medium' ? mediumQuestion : hardQuestion;
    let q = maker();
    let guard = 0;
    while (recentKeys.includes(q.key) && guard < 20) { q = maker(); guard++; }
    return q;
  }

  window.ElementBattleQuestions = { generateQuestion };
})();
