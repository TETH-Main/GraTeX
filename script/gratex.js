export class GraTeXUtils {
    constructor(app) {
        this.app = app;
        this.width = 1920;
        this.height = 1080;
        this.graphSize = 640;
        this.graphMargin = 96;
        this.labelPos = 720;
        this.fillColor = '#ffffff';
    }

    generate() {
        [this.width, this.height, this.graphSize, this.graphMargin, this.labelPos] = this.app.imageDimension.value.split(',').map(num => +num);
        this.fillColor = this.app.color.value;

        this.generatePNG();
        this.generateSVG();
    }

    generatePNG() {
        const graphImg = new Image();
        const mergeImg = new Image();
        const fullCaptureImg = new Image();
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = this.width;
        canvas.height = this.height;

        const is2D = document.querySelector('input[name="version"]:checked').value === 'version-2d';
        Promise.all([
            new Promise(resolve => (graphImg.onload = resolve)),
            new Promise(resolve => (mergeImg.onload = resolve)),
            new Promise(resolve => (fullCaptureImg.onload = resolve))
        ]).then(() => {
            // 背景色設定
            context.fillStyle = this.fillColor;
            context.fillRect(0, 0, this.width, this.height);

            // 濃薄色判定
            const invertGraph = is2D && this.app.calculator2D.graphSettings.invertedColors;
            const invertLabel = ColorUtils.contrast(this.app.color.value) === 'white';
            if (invertGraph) this.reverse(context);

            // グラフ描画位置設定
            const graphWidth = this.graphSize * (this.app.widegraph.checked + 1);
            const graphLeft = (this.width - graphWidth) >> 1;

            // グラフ描画
            // graphOnlyの場合 グラフを中央に描きlatexを消す
            context.drawImage(graphImg, graphLeft, 
                this.app.graphOnly.checked ? (this.height - this.graphSize) >> 1 : this.graphMargin,
                graphWidth, this.graphSize);

            // 濃色であれば色反転
            if (invertGraph !== invertLabel) this.reverse(context);
            context.lineWidth = this.width / 1440;

            // 枠描画
            if (this.app.frame.checked) context.strokeRect(graphLeft,
                this.app.graphOnly.checked ? (this.height - this.graphSize) >> 1 : this.graphMargin,
                graphWidth, this.graphSize);

            // 透過で画像合成できるよう乗算
            context.globalCompositeOperation = 'multiply';
            // LaTeX入りの背景を描画
            if (!this.app.graphOnly.checked) context.drawImage(mergeImg, 0, 0, this.width, this.height);

            // credit描画
            context.font = this.labelPos / 24 + 'px serif';
            context.fillStyle = 'black';
            context.textAlign = 'right';
            if (this.app.credit.checked) context.fillText('Graph + LaTeX = GraTeX by @TETH_Main', this.width - 10, this.height - 10);

            // 濃色であれば色反転
            if (invertLabel) this.reverse(context);

            // srcセット
            let imgSrc = this.app.fullCapture.checked ? fullCaptureImg.src : canvas.toDataURL();
            this.app.downloadPNG.href = this.app.preview.src = imgSrc;

            this.app.preview.style.maxWidth = this.width + 'px';
            this.app.containerElt.style.display = 'block';
        });

        const calculator = is2D ? this.app.calculator2D : this.app.calculator3D;
        graphImg.src = calculator.screenshot({
            width: 320 * (this.app.widegraph.checked + 1),
            height: 320,
            targetPixelRatio: this.graphSize / 320
        });

        const label = this.app.getLabel(calculator);
        const ratio = (Math.min(this.width, this.height) >= 360) + 1;
        this.app.calculatorLabelScreenshot.setExpression({
            id: 'label',
            latex: `\\left(0,-${this.labelPos / ratio}\\right)`,
            color: 'black',
            label: `\`${this.app.labelFont.value ? `\\${this.app.labelFont.value}{${label}}` : label}\``,
            hidden: true,
            showLabel: true,
            secret: true,
            labelSize: this.app.labelSize.value * this.labelPos + '/' + 720 * ratio
        });
        this.app.calculatorLabelScreenshot.asyncScreenshot(
            {
                showLabels: true,
                width: this.width / ratio,
                height: this.height / ratio,
                targetPixelRatio: ratio,
                mathBounds: {
                    left: -this.width / ratio,
                    right: this.width / ratio,
                    bottom: -this.height,
                    top: this.height
                }
            },
            s => (mergeImg.src = s)
        );

        fullCaptureImg.src = calculator.screenshot({
            width: this.width,
            height: this.height
        });
    }

    reverse(context) {
        context.globalCompositeOperation = 'difference';
        context.fillStyle = 'white';
        context.fillRect(0, 0, 1920, 1080);
        context.globalCompositeOperation = 'normal';
    }

    generateSVG() {
        this.app.svgPreview.innerHTML = '';
        const is3D = document.querySelector('input[name="version"]:checked').value === 'version-3d';
        if(is3D) {
            this.app.downloadSVG.classList.add('disabled');
            return;
        } else this.app.downloadSVG.classList.remove('disabled');

        const SVGcanvas = this.createSVGCanvas(this.width, this.height, this.fillColor);
        const calculator = this.app.calculator2D;

        const asyncScreenshot = (options) => {
            return new Promise((resolve) => {
                calculator.asyncScreenshot(options, resolve);
            });
        };

        asyncScreenshot({
            format: 'svg',
            width: 320 * (this.app.widegraph.checked + 1),
            height: 320
        }).then(s => { // SVGcanvas
            const elements = this.stringToDOM(s).childNodes;
            const graphWidth = this.graphSize * (this.app.widegraph.checked + 1);
            const graphLeft = (this.width - graphWidth) >> 1;
            const graphMargin = this.app.graphOnly.checked ? (this.height - this.graphSize) >> 1 : this.graphMargin;
            const graphScale = this.graphSize / 320;
            const labelColor = ColorUtils.contrast(this.app.color.value);

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (element.nodeName === 'defs') {
                    SVGcanvas.appendChild(element.cloneNode(true));
                } else if (element.nodeName === 'g') {
                    const clonedElement = element.cloneNode(true);
                    clonedElement.setAttribute('transform', `translate(${graphLeft}, ${graphMargin}) scale(${graphScale}, ${graphScale})`);
                    SVGcanvas.appendChild(clonedElement);
                }
            }
            if (this.app.frame.checked) this.addSVGRect(SVGcanvas, graphLeft, graphMargin, graphWidth, this.graphSize);
            if (!this.app.graphOnly.checked) this.addSVGLabel(calculator, SVGcanvas, labelColor);
            if (this.app.credit.checked) this.addSVGCredit(SVGcanvas, labelColor);

            this.app.svgPreview.appendChild(SVGcanvas);

            return asyncScreenshot({
                format: 'svg',
                width: this.width,
                height: this.height
            });
        }).then(s => { // fullCaptureSvg
            // const fullCaptureSvg = this.stringToDOM(s);
            // this.app.svgPreview.appendChild(fullCaptureSvg);

            let svgString = this.domToString(SVGcanvas);
            if(this.app.fullCapture.checked) svgString = s;

            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            this.app.downloadSVG.href = url;
        });
    }

    createSVGCanvas(width, height, backgroundColor, idName = 'svgCanvas') {
        const SVGCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        SVGCanvas.setAttribute('width', width);
        SVGCanvas.setAttribute('height', height);
        SVGCanvas.setAttribute('id', idName);

        this.addSVGRect(SVGCanvas, 0, 0, width, height, backgroundColor);

        return SVGCanvas;
    }

    addSVGRect(svg, x, y, width, height, color = 'none') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', 1);
        svg.appendChild(rect);
    }

    addSVGLabel(calculator, SVGcanvas, labelColor = 'black') {
        // mathjaxで(pathで描かれた)latexを追加
        const label = this.app.getLabel(calculator, 'svg', this.app.labelFont.value);
        this.app.mathjaxPreview.innerHTML = `\\( ${label} \\)`;
        MathJax.typesetPromise([this.app.mathjaxPreview]);
        
        // 生成したmathjaxのタグを取得後 下のsvgを操作
        // <mjx-container>
        //   <svg>
        //     <defs>...</defs>
        //     <g>...</g>
        //   </svg>
        // </mjx-container>
        const mathjaxElement = document.getElementsByTagName('mjx-container')[0].childNodes[0]
        const svgElements = mathjaxElement.childNodes;
        const defaultSvgWidth = 8 * 54.5 * parseFloat(mathjaxElement.getAttribute('width')); // defaulでの横幅pxサイズ (8px/1em, x5.45 = fontSize:4)
        const svgScale = 0.065 * (this.app.labelSize.value / 4) * (this.labelPos / 720); // default=4, 0.065調整
        const svgWidth = defaultSvgWidth * svgScale;
        const svgLeft = (this.width - svgWidth) >> 1;
        const svgMargin = (1000 * svgScale + this.height + this.labelPos) >> 1; // 1000*svgScale = 1行の高さ height+labelPos = 1行目の位置
        
        for (let i = 0; i < svgElements.length; i++) {
            const element = svgElements[i];
            if (element.nodeName === 'defs') {
                SVGcanvas.appendChild(element.cloneNode(true));
            } else if (element.nodeName === 'g') {
                const clonedElement = element.cloneNode(true);
                clonedElement.setAttribute(
                    'transform', 
                    `translate(${svgLeft}, ${svgMargin}) scale(${svgScale}, -${svgScale})`
                );
                clonedElement.setAttribute('fill', labelColor);
                clonedElement.setAttribute('stroke', labelColor);
                SVGcanvas.appendChild(clonedElement);
            }
        }
    }

    addSVGCredit(SVGcanvas, labelColor = 'black') {
        const credit = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        credit.setAttribute('x', this.width - 10);
        credit.setAttribute('y', this.height - 10);
        credit.setAttribute('font-size', `${this.labelPos / 24}`);
        credit.setAttribute('font-family', 'serif');
        credit.setAttribute('text-anchor', 'end');
        credit.setAttribute('fill', labelColor);
        credit.textContent = 'Graph + LaTeX = GraTeX by @TETH_Main';
        SVGcanvas.appendChild(credit);
    }

    stringToDOM(s) {
        const parser = new DOMParser();
        const svgDOM = parser.parseFromString(s, 'image/svg+xml');
        return svgDOM.documentElement;
    }

    domToString(dom) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(dom);
    }
}
