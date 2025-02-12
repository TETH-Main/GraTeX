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
    }

    initButtons() {
        const btnElt = document.getElementById('screenshot-button');
        btnElt.addEventListener('click', () => this.generate());

        const btnImp = document.getElementById('import-button');
        btnImp.addEventListener('click', () => this.importGraph(desmosHash.value));
    }

    initElements() {
        this.containerElt = document.getElementById('generate-container');
        this.preview = document.getElementById('preview');
        this.download = document.getElementById('downloadButton');
        this.labelFont = document.forms.labelFont.elements[0];
        this.labelSize = document.forms.labelSize.elements[0];
        this.imageDimension = document.forms.imageDimension.elements[0];
        this.color = document.getElementById('color');
        this.widegraph = document.getElementById('widegraph');
        this.credit = document.getElementById('credit');
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

    generate() {
        const graphImg = new Image();
        const mergeImg = new Image();
        const [width, height, graphSize, graphMargin, labelPos] = this.imageDimension.value.split(',').map(num => +num);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        const is2D = document.querySelector('input[name="version"]:checked').value === 'version-2d';
        Promise.all([
            new Promise(resolve => (graphImg.onload = resolve)),
            new Promise(resolve => (mergeImg.onload = resolve))
        ]).then(() => {
            context.fillStyle = this.color.value;
            context.fillRect(0, 0, width, height);

            const invertGraph = is2D && this.calculator2D.graphSettings.invertedColors;
            const invertLabel = ColorUtils.contrast(this.color.value) === 'white';
            if (invertGraph) this.reverse(context);

            const graphWidth = graphSize * (this.widegraph.checked + 1);
            const graphLeft = (width - graphWidth) >> 1;
            context.drawImage(graphImg, graphLeft, graphMargin, graphWidth, graphSize);

            if (invertGraph !== invertLabel) this.reverse(context);
            context.lineWidth = width / 1440;
            context.strokeRect(graphLeft, graphMargin, graphWidth, graphSize);

            context.globalCompositeOperation = 'multiply';
            context.drawImage(mergeImg, 0, 0, width, height);
            context.font = labelPos / 24 + 'px serif';
            context.fillStyle = 'black';
            context.textAlign = 'right';
            if (this.credit.checked) context.fillText('Graph + LaTeX = GraTeX by @TETH_Main', width - 10, height - 10);
            if (invertLabel) this.reverse(context);

            this.download.href = this.preview.src = canvas.toDataURL();
            this.preview.style.maxWidth = width + 'px';
            this.containerElt.style.display = 'block';
        });

        const calculator = is2D ? this.calculator2D : this.calculator3D;
        graphImg.src = calculator.screenshot({
            width: 320 * (this.widegraph.checked + 1),
            height: 320,
            targetPixelRatio: graphSize / 320
        });

        const label = this.getLabel(calculator);
        const ratio = (Math.min(width, height) >= 360) + 1;
        this.calculatorLabelScreenshot.setExpression({
            id: 'label',
            latex: `\\left(0,-${labelPos / ratio}\\right)`,
            color: 'black',
            label: `\`${this.labelFont.value ? `\\${this.labelFont.value}{${label}}` : label}\``,
            hidden: true,
            showLabel: true,
            secret: true,
            labelSize: this.labelSize.value * labelPos + '/' + 720 * ratio
        });
        this.calculatorLabelScreenshot.asyncScreenshot(
            {
                showLabels: true,
                width: width / ratio,
                height: height / ratio,
                targetPixelRatio: ratio,
                mathBounds: {
                    left: -width / ratio,
                    right: width / ratio,
                    bottom: -height,
                    top: height
                }
            },
            s => (mergeImg.src = s)
        );
    }

    reverse(context) {
        context.globalCompositeOperation = 'difference';
        context.fillStyle = 'white';
        context.fillRect(0, 0, 1920, 1080);
        context.globalCompositeOperation = 'normal';
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

    getLabel(calculator) {
        switch (document.querySelector('input[name="label"]:checked').value) {
            case 'hide':
                return '?????????';
            case 'top-expression':
                const exp = calculator.getExpressions().find(exp => exp.latex);
                return exp ? exp.latex : '?????????';
            case 'custom':
                const exps = this.calculatorLabel.getExpressions().map(exp => `\\class{multiline-item}{${exp.latex ?? ''}}`);
                return exps.length ? `\\class{multiline-list}{${exps.join('')}}` : '?????????';
        }
    }
}

// アプリケーションの起動
new GraTeXApp();
