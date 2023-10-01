var btnElt = document.getElementById('screenshot-button');
btnElt.addEventListener('click', generate);

var btnImp = document.getElementById('import-button');
btnImp.addEventListener('click', importGraph);

var containerElt = document.getElementById('generate-container');

var preview = document.getElementById('preview');
var download = document.getElementById('downloadButton');
var labelSize = document.forms.labelSize.elements[0];
var imageDimension = document.forms.imageDimension.elements[0];

var color = document.getElementById('color');
var widegraph = document.getElementById('widegraph');
var credit = document.getElementById('credit');
var hideLaTeX = document.getElementById('hideLaTeX');

window.onload = () => {
    var q = getUrlQueries();
    if (q['widegraph'] || q['Widegraph'] || q['wideGraph'] || q['WideGraph'] || q['wide'] || q['Wide'] || q['w'] || q['W']) widegraph.checked = true;
    if (q['credit'] || q['Credit'] || q['addcredit'] || q['Addcredit'] || q['AddCredit'] || q['c'] || q['C']) credit.checked = true;
    if (q['hideLaTeX'] || q['HideLaTeX'] || q['hidelatex'] || q['Hidelatex'] || q['hide'] || q['Hide'] || q['h'] || q['H']) hideLaTeX.checked = true;
    if (q['url'] !== undefined) loadGraph(q['url']);
};

var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');

preview.onload = () => {
    containerElt.style.display = 'block';
    preview.onload = null;
};

function generate() {
    var pageY = pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    var pageX = pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    scrollTo(0, 0);
    containerElt.style.display = 'none';

    var graphImg = new Image();
    var mergeImg = new Image();
    var widegraphImg = new Image();
    var [width, height, graphSize, graphMargin, labelPos] = imageDimension.value.split(",").map(num => +num);
    canvas.width = width;
    canvas.height = height;

    Promise.all([
        new Promise(resolve => graphImg.onload = resolve),
        new Promise(resolve => mergeImg.onload = resolve)
    ]).then(() => {
        context.globalCompositeOperation = 'normal';
        context.fillStyle = color.value;
        context.save();
        context.fillRect(0, 0, width, height);

        context.drawImage(graphImg, (width - graphSize) >> 1, graphMargin, graphSize, graphSize);
        if (widegraph.checked) context.drawImage(widegraphImg, (width - (graphSize << 1)) >> 1, graphMargin, graphSize << 1, graphSize);

        context.lineWidth = width / 1440;
        if (widegraph.checked) context.strokeRect((width - (graphSize << 1)) >> 1, graphMargin, graphSize << 1, graphSize);
        else context.strokeRect((width - graphSize) >> 1, graphMargin, graphSize, graphSize);

        reverse();
        context.globalCompositeOperation = 'multiply';
        context.drawImage(mergeImg, 0, 0, width, height);
        context.font = labelPos / 24 + 'px serif';
        context.fillStyle = 'black';
        context.textAlign = 'right';
        if (credit.checked) context.fillText('Graph + LaTeX = GraTeX by @TETH_Main', width - 10, height - 10);
        reverse();

        context.restore();
        context.fillRect(0, height - 1, width, height);

        download.href = preview.src = canvas.toDataURL();
    });

    graphImg.src = calculator.screenshot({
        width: 320,
        height: 320,
        targetPixelRatio: 2
    });

    widegraphImg.src = calculator.screenshot({
        width: 640,
        height: 320,
        targetPixelRatio: 2
    });

    var e = calculator.getExpressions().find(exp => exp.latex);
    calculator.setExpression({
        id: e.id,
        lineWidth: '4'
    });
    calculator.setExpression({
        id: 'background',
        latex: 'x^2>-1',
        color: 'white',
        fillOpacity: '1',
        secret: true
    });
    var label = e.latex;
    if (hideLaTeX.checked) label = '?????????';
    calculator.setExpression({
        id: 'label',
        latex: '\\left(0,-' + labelPos + '\\right)',
        color: 'black',
        label: '`' + label + '`',
        hidden: true,
        showLabel: true,
        secret: true,
        labelSize: labelSize.value * labelPos + '/1440'
    });
    calculator.asyncScreenshot({
        showLabels: true,
        width: width >> 1,
        height: height >> 1,
        targetPixelRatio: 2,
        mathBounds: {
            left: -width >> 1,
            right: width >> 1,
            bottom: -height,
            top: height
        }
    }, s => {
        mergeImg.src = s;
        calculator.removeExpression({
            id: 'background'
        });
        calculator.removeExpression({
            id: 'label'
        });
        calculator.setExpression({
            id: e.id,
            lineWidth: e.lineWidth
        });
        scrollTo(pageX, pageY);
        containerElt.style.display = 'block';
    });
}

function reverse() {
    if (contrast(color.value) == 'white') {
        context.globalCompositeOperation = 'difference';
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1920, 1080);
    }
}

function getUrlQueries() {
    return Object.fromEntries(new URLSearchParams(location.search).entries());
}

function importGraph() {
    var hash = document.getElementById("desmos-hash").value;
    if (hash !== "") loadGraph(hash);
}

function loadGraph(hash) {
    var url = 'https://saved-work.desmos.com/calc-states/production/' + hash;
    fetch(url).then(response => response.json()).then(state => calculator.setState(state));
}
