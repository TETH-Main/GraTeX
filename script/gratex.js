import { GraTeXUtils } from './GraTeXUtils.js';

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
            sliders: false,
            actions: false,
            branding: false
        });
        this.calculatorLabelScreenshot = Desmos.GraphingCalculator(document.createElement('div'), {
            showGrid: false,
            showXAxis: false,
            showYAxis: false
        });

        this.initButtons();
        this.initElements();
        this.initEventListeners();

        this.utils = new GraTeXUtils(this);
    }

    initButtons() {
        const btnElt = document.getElementById('screenshot-button');
        btnElt.addEventListener('click', () => this.utils.generate());

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

    getLabel(calculator, format = 'png', font = '') {
        switch (document.querySelector('input[name="label"]:checked').value) {
            case 'hide':
                return '?????????';
            case 'top-expression':
                const exp = calculator.getExpressions().find(exp => exp.latex);
                if (format === 'png') return exp ? exp.latex : '?????????';
                else if (format === 'svg') return exp ? `\\begin{gather} \\${font}{${exp.latex}} \\end{gather}` : '?????????';
                return exp ? exp.latex : '?????????';
            case 'custom':
                const exps = this.calculatorLabel.getExpressions().map(exp => exp.latex ?? '');
                if (format === 'png') {
                    const labels = exps.map(e => `\\class{multiline-item}{${e ?? ''}}`);
                    return labels.length ? `\\class{multiline-list}{${labels.join('')}}` : '?????????';
                } else if (format === 'svg') {
                    const labels = exps.map(e => e.replace(/ /g, "\\ ").trim());
                    const fontWrappedLabels = labels.map(line => font ? `\\${font}{${line}}` : line);
                    return fontWrappedLabels.length ? `\\begin{gather} ${fontWrappedLabels.join(" \\\\ ")} \\end{gather}` : '?????????';
                } else {
                    return '?????????';
                }
        }
    }
}

// アプリケーションの起動
new GraTeXApp();
