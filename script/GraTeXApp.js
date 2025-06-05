import { GraTeXUtils } from './GraTeXUtils.js';
import { MovieGenerator } from './MovieGenerator.js';
import { GraTeXUI } from './GraTeXUI.js';

class GraTeXApp {
    constructor() {
        this.calcElt = document.getElementById('calculator');
        this.calculator2D = Desmos.GraphingCalculator(this.calcElt, {
            border: false,
            pasteGraphLink: true
        });
        this.calculator2D.setExpression({ latex: 'x^2+y^2=10' });

        this.calcLabelElt = document.getElementById('calculator-label');
        this.calcLabelElt.style.display = 'none';
        this.calculatorLabel = Desmos.GraphingCalculator(this.calcLabelElt, {
            border: false,
            graphpaper: false,
            settingsMenu: false,
            images: false,
            folders: false,
            notes: false,
            // sliders: false,
            actions: false,
            branding: false
        });
        this.calculatorLabelScreenshot = Desmos.GraphingCalculator(document.createElement('div'), {
            showGrid: false,
            showXAxis: false,
            showYAxis: false
        });

        this.addVariableLabelEnabled = false;
        this.originalLabelMode = null;
        this.topExpressionLatex = null;

        this.initButtons();
        this.initElements();
        this.initEventListeners();

        this.utils = new GraTeXUtils(this);
        this.movie = new MovieGenerator();
        
        this.ui = new GraTeXUI(this);
        
        this.initMovieGenerator();
    }

    initButtons() {
        const btnElt = document.getElementById('screenshot-button');
        btnElt.addEventListener('click', () => {
            this.movie.stopMovieAnimation();
            this.utils.generate();
        });

        const btnImp = document.getElementById('import-button');
        btnImp.addEventListener('click', () => this.importGraph(this.desmosHash.value));
    }

    initElements() {
        this.containerElt = document.getElementById('generate-container');
        this.preview = document.getElementById('preview');
        this.svgPreview = document.getElementById('svg-preview');
        this.downloadPNG = document.getElementById('downloadPNGButton');
        this.downloadSVG = document.getElementById('downloadSVGButton');
        this.mathjaxPreview = document.getElementById('mathjax-preview');
        this.labelFont = document.forms.labelFont.elements[0];
        this.labelSize = document.forms.labelSize.elements[0];
        this.imageDimension = document.forms.imageDimension.elements[0];
        this.color = document.getElementById('color');
        this.frame = document.getElementById('frame');
        this.widegraph = document.getElementById('widegraph');
        this.credit = document.getElementById('credit');
        this.graphOnly = document.getElementById('graph-only');
        this.fullCapture = document.getElementById('full-capture');
        this.hideLaTeX = document.getElementById('hideLaTeX');
        this.desmosHash = document.getElementById('desmos-hash');

        this.calc3DElt = document.getElementById('calculator-3d');
        this.calc3DElt.style.display = 'none';
    }

    initEventListeners() {
        window.onload = () => {
            const q = this.getUrlQueries();
            if (q['widegraph'] || q['wide'] || q['w']) this.widegraph.checked = true;
            if (q['addcredit'] || q['credit'] || q['c']) this.credit.checked = true;
            if (q['hidelatex'] || q['hide'] || q['h']) this.hideLaTeX.checked = true;
            if (q['3d']) {
                document.getElementById('version-3d').checked = true;
                this.calcElt.style.display = 'none';
                this.calc3DElt.style.display = '';
            }
            this.importGraph(q['url'] || q['hash']);
        };

        document.querySelectorAll('input[name="version"]').forEach(element => {
            element.addEventListener('change', event => {
                const is2D = event.target.value === 'version-2d';
                this.calcElt.style.display = is2D ? '' : 'none';
                this.calc3DElt.style.display = is2D ? 'none' : '';
            });
        });

        this.calc3DElt.onload = () => {
            this.calculator3D = this.calc3DElt.contentWindow.Calc;
            console.log(this.calc3DElt.contentWindow.Calc);
        };

        document.querySelectorAll('input[name="label"]').forEach(element => {
            element.addEventListener('change', event => {
                this.calcLabelElt.style.display = event.target.value === 'custom' ? '' : 'none';
            });
        });
    }

    getUrlQueries() {
        return Object.fromEntries(
            Array.from(new URLSearchParams(location.search), ([key, value]) => [key.toLowerCase(), value || true])
        );
    }

    importGraph(hash) {
        if (hash) {
            const match =
                /^\s*(?:https?:\/\/)?(?:[-a-zA-Z0-9]*\.)?desmos\.com(?::[0-9]+)?\/(calculator|3d)\/([^?#\/\s]+)/.exec(hash);
            if (match) this.loadGraph(match[2], match[1] === 'calculator');
            else this.loadGraph(hash, document.querySelector('input[name="version"]:checked').value === 'version-2d');
        }
    }

    loadGraph(hash, is2D) {
        let url = is2D
            ? 'https://saved-work.desmos.com/calc-states/production/'
            : 'https://saved-work.desmos.com/calc-3d-states/production/';
        url += hash;
        fetch(url)
            .then(response => response.json())
            .then(state => {
                document.getElementById(is2D ? 'version-2d' : 'version-3d').checked = true;
                (is2D ? this.calculator2D : this.calculator3D).setState(state);
                this.desmosHash.value = '';
                this.calcElt.style.display = is2D ? '' : 'none';
                this.calc3DElt.style.display = is2D ? 'none' : '';
            });
    }

    async initMovieGenerator() {
        try {
            await this.movie.init(this);
            console.log('GraTeX: MovieGenerator initialized successfully');
        } catch (error) {
            console.warn('GraTeX: MovieGenerator initialization failed:', error);
        }
    }

    getLabel(calculator, format = 'png', font = '') {
        switch (document.querySelector('input[name="label"]:checked').value) {
            case 'hide':
                return '?????????';
            case 'top-expression':
                const exp = calculator.getExpressions().find(exp => exp.latex);
                if (!exp) return '?????????';
                if (format === 'png') return exp.latex;
                else if (format === 'svg') return `${font ? `\\${font}{${exp.latex}}` : exp.latex}`;
            case 'custom':
                const exps = this.calculatorLabel.getExpressions().map(exp => exp.latex ?? '');
                if (exps.length === 0) return '?????????';
                if (format === 'png') {
                    const labels = exps.map(e => `\\class{multiline-item}{${e ?? ''}}`);
                    return `\\class{multiline-list}{${labels.join('')}}`;
                } else if (format === 'svg') {
                    const labels = exps.map(e => e.replace(/ /g, "\\ ").trim());
                    const fontWrappedLabels = labels.map(line => font ? `\\${font}{${line}}` : line);
                    return `\\begin{gather} ${fontWrappedLabels.join(" \\\\ ")} \\end{gather}`;
                }
        }
    }

    // labelラジオボタンを指定のvalueにセットするメソッド
    setLabelRadioValue(value) {
        const radio = document.querySelector(`input[name="label"][value="${value}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }
    }

    // 現在選択されているlabel値を返すメソッド
    getCurrentLabelValue() {
        const labelRadios = document.querySelectorAll('input[name="label"]');
        for (const radio of labelRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return null;
    }

    // 現在表示しているグラフ計算機が2Dかどうかを返す
    is2DCalculatorActive() {
        const checked = document.querySelector('input[name="version"]:checked');
        return checked ? checked.value === 'version-2d' : true;
    }

    // 現在表示しているグラフ計算機(Desmosインスタンス)を返す
    getActiveCalculator() {
        return this.is2DCalculatorActive() ? this.calculator2D : this.calculator3D;
    }

    /**
     * this.calculatorの変数を更新する
     * @param {string} id - 更新する変数のid
     * @param {float} value - 更新する値
     */
    updateVariableInCalculator(id, value) {
        const calculator = this.getActiveCalculator();
        if (calculator) {
            calculator.controller.dispatch({
                type: 'adjust-slider-by-dragging-thumb',
                id: id,
                target: value,
            });
        }
    }

    /**
     * this.calculatorLabelに変数がセットされているかどうかを返す
     * @param {string} variable - チェックする変数名
     * @returns {boolean} - 変数がセットされている場合はtrue、そうでない場合はfalse
     */
    hasVariableInLabel(variable) {
        const variables = this.calculatorLabel.controller.listModel.__itemModelArray
                    .filter(e => e.sliderExists)
                    .map(e => e.formula.assignment)
        return variables.includes(variable);
    }

    /**
     * this.calculatorLabelに変数をセットする
     * @param {string} variable - セットする変数名
     * @param {string} value - セットする値
     */
    setVariableInLabel(variable, value) {
        if (!this.hasVariableInLabel(variable)) {
            this.calculatorLabel.setExpression({
                id: 'grapen-variable',
                latex: `${variable}=${value}`
            });
        }
    }

    /**
     * this.calculatorLabelの変数のidを取得する
     * @param {string} variable - 取得する変数名
     * @returns {string|null} - 変数のidが存在する場合はそのid、存在しない場合はnull
     */
    getVariableIdInLabel(variable) {
        const variableItem = this.calculatorLabel.controller.listModel.__itemModelArray
            .find(e => e.sliderExists && e.formula.assignment === variable);
        return variableItem ? variableItem.id : null;
    }

    /**
     * this.calculatorLabelの変数を更新する
     * @param {string} id - 更新する変数のid
     * @param {float} value - 更新する値
     */
    updateVariableInLabel(id = null, value) {
        this.calculatorLabel.controller.dispatch({
            type: 'adjust-slider-by-dragging-thumb',
            id: id || 'grapen-variable',
            target: value,
        });
    }

    /**
     * LaTeX数式を評価して数値を返す（無効ならnull）
     * @param {string} latex
     * @param {boolean} degreeMode
     * @returns {number|null}
     */
    evaluateLatex(latex, degreeMode = false) {
        if (!latex || typeof window.Desmos?.Private?.Fragile?.evaluateLatex !== 'function') return null;
        try {
            const v = window.Desmos.Private.Fragile.evaluateLatex(latex, degreeMode);
            return (typeof v === 'number' && !isNaN(v)) ? v : null;
        } catch {
            return null;
        }
    }
}

// アプリケーションの起動
window.GraTeX = new GraTeXApp();
