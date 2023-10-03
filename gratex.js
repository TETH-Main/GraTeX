var calcElt = document.getElementById('calculator');
var calculator2D = Desmos.GraphingCalculator(calcElt, {
    border: false,
    pasteGraphLink: true
});
calculator2D.setExpression({ latex: 'x^2+y^2=10' });

var calculatorLabel = Desmos.GraphingCalculator(document.createElement('div'), {
    showGrid: false,
    showXAxis: false,
    showYAxis: false
});

var btnElt = document.getElementById('screenshot-button');
btnElt.addEventListener('click', generate);

var btnImp = document.getElementById('import-button');
btnImp.addEventListener('click', () => importGraph(desmosHash.value));

var containerElt = document.getElementById('generate-container');

var preview = document.getElementById('preview');
var download = document.getElementById('downloadButton');
var labelSize = document.forms.labelSize.elements[0];
var imageDimension = document.forms.imageDimension.elements[0];

var color = document.getElementById('color');
var widegraph = document.getElementById('widegraph');
var credit = document.getElementById('credit');
var hideLaTeX = document.getElementById('hideLaTeX');
var desmosHash = document.getElementById('desmos-hash');

window.onload = () => {
    var q = getUrlQueries();
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

var calc3DElt = document.getElementById('calculator-3d');
calc3DElt.style.display = 'none';
document.querySelectorAll('input[name="version"]').forEach(element => {
    element.addEventListener('change', event => {
        var is2D = event.target.value === 'version-2d';
        calcElt.style.display = is2D ? '' : 'none';
        calc3DElt.style.display = is2D ? 'none' : '';
    });
});

var calculator3D;
calc3DElt.onload = () => {
    calculator3D = calc3DElt.contentWindow.Calc;
};

var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');

function generate() {
    var graphImg = new Image();
    var mergeImg = new Image();
    var [width, height, graphSize, graphMargin, labelPos] = imageDimension.value.split(',').map(num => +num);
    var doubleGraphSize = graphSize << 1;
    canvas.width = width;
    canvas.height = height;

    var is2D = document.querySelector('input[name="version"]:checked').value === 'version-2d';
    Promise.all([
        new Promise(resolve => graphImg.onload = resolve),
        new Promise(resolve => mergeImg.onload = resolve)
    ]).then(() => {
        context.fillStyle = color.value;
        context.fillRect(0, 0, width, height);

        var invertGraph = is2D && calculator2D.graphSettings.invertedColors;
        var invertLabel = contrast(color.value) === 'white';
        if (invertGraph) reverse();

        if (widegraph.checked) context.drawImage(graphImg, (width - doubleGraphSize) >> 1, graphMargin, doubleGraphSize, graphSize);
        else context.drawImage(graphImg, (width - graphSize) >> 1, graphMargin, graphSize, graphSize);

        if (invertGraph !== invertLabel) reverse();
        context.lineWidth = width / 1440;
        if (widegraph.checked) context.strokeRect((width - doubleGraphSize) >> 1, graphMargin, doubleGraphSize, graphSize);
        else context.strokeRect((width - graphSize) >> 1, graphMargin, graphSize, graphSize);

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

    var calculator = is2D ? calculator2D : calculator3D;
    var exp = calculator.getExpressions().find(exp => exp.latex);
    if (!exp) return;

    calculator.asyncScreenshot({
        showLabels: true,
        width: 320 * (widegraph.checked + 1),
        height: 320,
        targetPixelRatio: graphSize / 320
    }, s => graphImg.src = s);

    var label = hideLaTeX.checked ? '?????????' : exp.latex;
    var ratio = (Math.min(width, height) >= 360) + 1;
    calculatorLabel.setExpression({
        id: 'label',
        latex: '\\left(0,-' + labelPos + '\\right)',
        color: 'black',
        label: '`' + label + '`',
        hidden: true,
        showLabel: true,
        secret: true,
        labelSize: labelSize.value * labelPos + '/' + 720 * ratio
    });
    calculatorLabel.asyncScreenshot({
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
    }, s => mergeImg.src = s);
}

function reverse() {
    context.globalCompositeOperation = 'difference';
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1920, 1080);
    context.globalCompositeOperation = 'normal';
}

function getUrlQueries() {
    return Object.fromEntries(Array.from(new URLSearchParams(location.search), ([key, value]) => [key.toLowerCase(), value || true]));
}

function importGraph(hash) {
    if (hash) {
        var match = /^\s*(?:https?:\/\/)?(?:[-a-zA-Z0-9]*\.)?desmos\.com(?::[0-9]+)?\/(calculator|3d)\/([^?#\/\s]+)/.exec(hash);
        if (match) loadGraph(match[2], match[1] === 'calculator');
        else loadGraph(hash, document.querySelector('input[name="version"]:checked').value === 'version-2d');
    }
}

function loadGraph(hash, is2D) {
    var url = is2D
        ? 'https://saved-work.desmos.com/calc-states/production/'
        : 'https://saved-work.desmos.com/calc-3d-states/production/';
    url += hash;
    fetch(url).then(response => response.json()).then(state => {
        document.getElementById(is2D ? 'version-2d' : 'version-3d').checked = true;
        (is2D ? calculator2D : calculator3D).setState(state);
        desmosHash.value = '';
        calcElt.style.display = is2D ? '' : 'none';
        calc3DElt.style.display = is2D ? 'none' : '';
    });
}
