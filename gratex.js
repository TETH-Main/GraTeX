const calcElt = document.getElementById('calculator');
const calculator2D = Desmos.GraphingCalculator(calcElt, {
    border: false,
    pasteGraphLink: true
});
calculator2D.setExpression({ latex: 'x^2+y^2=10' });

const calcLabelElt = document.getElementById('calculator-label');
calcLabelElt.style.display = 'none';
const calculatorLabel = Desmos.GraphingCalculator(calcLabelElt, {
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
const calculatorLabelScreenshot = Desmos.GraphingCalculator(document.createElement('div'), {
    showGrid: false,
    showXAxis: false,
    showYAxis: false
});

const btnElt = document.getElementById('screenshot-button');
btnElt.addEventListener('click', generate);

const btnImp = document.getElementById('import-button');
btnImp.addEventListener('click', () => importGraph(desmosHash.value));

const containerElt = document.getElementById('generate-container');

const preview = document.getElementById('preview');
const download = document.getElementById('downloadButton');
const labelFont = document.forms.labelFont.elements[0];
const labelSize = document.forms.labelSize.elements[0];
const imageDimension = document.forms.imageDimension.elements[0];

const color = document.getElementById('color');
const widegraph = document.getElementById('widegraph');
const credit = document.getElementById('credit');
const hideLaTeX = document.getElementById('hideLaTeX');
const desmosHash = document.getElementById('desmos-hash');

window.onload = () => {
    const q = getUrlQueries();
    if (q['widegraph'] || q['wide'] || q['w']) widegraph.checked = true;
    if (q['addcredit'] || q['credit'] || q['c']) credit.checked = true;
    if (q['hidelatex'] || q['hide'] || q['h']) hideLaTeX.checked = true;
    if (q['3d']) {
        document.getElementById('version-3d').checked = true;
        calcElt.style.display = 'none';
        calc3DElt.style.display = '';
    }
    importGraph(q['url'] || q['hash']);
};

const calc3DElt = document.getElementById('calculator-3d');
calc3DElt.style.display = 'none';
document.querySelectorAll('input[name="version"]').forEach(element => {
    element.addEventListener('change', event => {
        const is2D = event.target.value === 'version-2d';
        calcElt.style.display = is2D ? '' : 'none';
        calc3DElt.style.display = is2D ? 'none' : '';
    });
});

let calculator3D;
calc3DElt.onload = () => {
    calculator3D = calc3DElt.contentWindow.Calc;
};

const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');

function generate() {
    const graphImg = new Image();
    const mergeImg = new Image();
    const [width, height, graphSize, graphMargin, labelPos] = imageDimension.value.split(',').map(num => +num);
    canvas.width = width;
    canvas.height = height;

    const is2D = document.querySelector('input[name="version"]:checked').value === 'version-2d';
    Promise.all([
        new Promise(resolve => (graphImg.onload = resolve)),
        new Promise(resolve => (mergeImg.onload = resolve))
    ]).then(() => {
        context.fillStyle = color.value;
        context.fillRect(0, 0, width, height);

        const invertGraph = is2D && calculator2D.graphSettings.invertedColors;
        const invertLabel = contrast(color.value) === 'white';
        if (invertGraph) reverse();

        const graphWidth = graphSize * (widegraph.checked + 1);
        const graphLeft = (width - graphWidth) >> 1;
        context.drawImage(graphImg, graphLeft, graphMargin, graphWidth, graphSize);

        if (invertGraph !== invertLabel) reverse();
        context.lineWidth = width / 1440;
        context.strokeRect(graphLeft, graphMargin, graphWidth, graphSize);

        context.globalCompositeOperation = 'multiply';
        context.drawImage(mergeImg, 0, 0, width, height);
        context.font = labelPos / 24 + 'px serif';
        context.fillStyle = 'black';
        context.textAlign = 'right';
        if (credit.checked) context.fillText('Graph + LaTeX = GraTeX by @TETH_Main', width - 10, height - 10);
        if (invertLabel) reverse();

        download.href = preview.src = canvas.toDataURL();
        preview.style.maxWidth = width + 'px';
        containerElt.style.display = 'block';
    });

    const calculator = is2D ? calculator2D : calculator3D;
    graphImg.src = calculator.screenshot({
        width: 320 * (widegraph.checked + 1),
        height: 320,
        targetPixelRatio: graphSize / 320
    });

    const label = getLabel(calculator);
    const ratio = (Math.min(width, height) >= 360) + 1;
    calculatorLabelScreenshot.setExpression({
        id: 'label',
        latex: `\\left(0,-${labelPos / ratio}\\right)`,
        color: 'black',
        label: `\`${labelFont.value ? `\\${labelFont.value}{${label}}` : label}\``,
        hidden: true,
        showLabel: true,
        secret: true,
        labelSize: labelSize.value * labelPos + '/' + 720 * ratio
    });
    calculatorLabelScreenshot.asyncScreenshot(
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

function reverse() {
    context.globalCompositeOperation = 'difference';
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1920, 1080);
    context.globalCompositeOperation = 'normal';
}

function getUrlQueries() {
    return Object.fromEntries(
        Array.from(new URLSearchParams(location.search), ([key, value]) => [key.toLowerCase(), value || true])
    );
}

function importGraph(hash) {
    if (hash) {
        const match =
            /^\s*(?:https?:\/\/)?(?:[-a-zA-Z0-9]*\.)?desmos\.com(?::[0-9]+)?\/(calculator|3d)\/([^?#\/\s]+)/.exec(hash);
        if (match) loadGraph(match[2], match[1] === 'calculator');
        else loadGraph(hash, document.querySelector('input[name="version"]:checked').value === 'version-2d');
    }
}

function loadGraph(hash, is2D) {
    let url = is2D
        ? 'https://saved-work.desmos.com/calc-states/production/'
        : 'https://saved-work.desmos.com/calc-3d-states/production/';
    url += hash;
    fetch(url)
        .then(response => response.json())
        .then(state => {
            document.getElementById(is2D ? 'version-2d' : 'version-3d').checked = true;
            (is2D ? calculator2D : calculator3D).setState(state);
            desmosHash.value = '';
            calcElt.style.display = is2D ? '' : 'none';
            calc3DElt.style.display = is2D ? 'none' : '';
        });
}

document.querySelectorAll('input[name="label"]').forEach(element => {
    element.addEventListener('change', event => {
        calcLabelElt.style.display = event.target.value === 'custom' ? '' : 'none';
    });
});

function getLabel(calculator) {
    switch (document.querySelector('input[name="label"]:checked').value) {
        case 'hide':
            return '?????????';
        case 'top-expression':
            const exp = calculator.getExpressions().find(exp => exp.latex);
            return exp ? exp.latex : '?????????';
        case 'custom':
            const exps = calculatorLabel
                .getExpressions()
                .flatMap(exp => (exp.latex ? [`\\textcolor{black}{${exp.latex}}`] : ''));
            const spacing = Math.max(Math.ceil(Math.log2(exps.length)) - 1, 1);
            return exps.length ? `\\textcolor{transparent}{${groupLines(exps, spacing)}}` : '?????????';
    }
}
