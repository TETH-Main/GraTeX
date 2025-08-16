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

    /**
     * Desmosグラフ計算機のDOM要素から数式の横幅を取得してAutoサイズを計算する
     * @returns {number} 計算されたlabelSize値
     */
    calculateAutoLabelSize() {
        try {
            console.log('Calculating auto label size...');
            // 現在のlabelタイプを取得
            const currentLabelValue = this.app.getCurrentLabelValue();
            
            let totalWidth = 0;
            let totalHeight = 0;
            
            if (currentLabelValue === 'hide') {
                // hideの場合は横幅0として扱うか、デフォルト値を返す
                console.log('Label is hidden, using default size');
                return 4;
            } else if (currentLabelValue === 'top-expression') {
                // top-expressionの場合：2D/3Dに応じて適切なコンテナから横幅・縦幅を取得
                const is2D = this.app.is2DCalculatorActive();
                const calculatorId = is2D ? '#calculator' : '#calculator-3d';
                
                const parentElement = document.querySelector(`${calculatorId} .dcg-template-expressioneach`);
                if (!parentElement) {
                    console.warn(`Desmos expression element not found in ${calculatorId}`);
                    return 4; // フォールバック値
                }

                // 数式のルートブロックを取得
                const rootBlocks = parentElement.querySelectorAll('.dcg-mq-root-block');
                if (rootBlocks.length === 0) {
                    console.warn(`Desmos math root blocks not found in ${calculatorId}`);
                    return 4; // フォールバック値
                }

                // 最初のルートブロック（通常は最上位の数式）の横幅・縦幅を計算
                const rootBlock = rootBlocks[0];

                // dcg-mq-root-block の直下の子ノードをループして横幅を計算
                Array.from(rootBlock.childNodes).forEach(node => {
                    // 要素ノード（HTMLタグ）のみを処理
                    if (node.nodeType === 1) {
                        totalWidth += node.offsetWidth;
                    }
                });

                // dcg-mq-root-blockの縦幅を取得
                totalHeight = rootBlock.offsetHeight;

                console.log(`Desmos top expression size (${is2D ? '2D' : '3D'}): ${totalWidth}px × ${totalHeight}px`);
            } else if (currentLabelValue === 'custom') {
                this.app.calculatorLabel.focusFirstExpression(); //一番上の指揮に移動
                
                // custom labelの場合：calculator-labelコンテナ内のDOM要素から横幅・縦幅を取得
                const parentElement = document.querySelector('#calculator-label .dcg-template-expressioneach');
                if (!parentElement) {
                    console.warn('Custom label expression element not found in calculator-label');
                    return 4; // フォールバック値
                }

                // 数式のルートブロックを取得
                const rootBlocks = parentElement.querySelectorAll('.dcg-mq-root-block');
                if (rootBlocks.length === 0) {
                    console.warn('Custom label math root blocks not found in calculator-label');
                    return 4; // フォールバック値
                }

                // すべてのルートブロックの横幅を計算して最大値を取得
                // すべてのルートブロックの縦幅を足し合わせる
                let maxWidth = 0;
                rootBlocks.forEach((rootBlock, index) => {
                    let blockWidth = 0;
                    
                    // dcg-mq-root-block の直下の子ノードをループして横幅を計算
                    Array.from(rootBlock.childNodes).forEach(node => {
                        // 要素ノード（HTMLタグ）のみを処理
                        if (node.nodeType === 1) {
                            blockWidth += node.offsetWidth;
                        }
                    });
                    
                    // dcg-mq-root-blockの縦幅を取得して合計に加算
                    const blockHeight = rootBlock.offsetHeight;
                    totalHeight += blockHeight;
                    
                    console.log(`Custom label block ${index + 1} size: ${blockWidth}px × ${blockHeight}px`);
                    maxWidth = Math.max(maxWidth, blockWidth);
                });

                totalWidth = maxWidth;
                console.log(`Custom label total size: ${totalWidth}px × ${totalHeight}px`);
            }

            if (totalWidth <= 0 || totalHeight <= 0) {
                console.warn('Invalid width or height calculated from label elements');
                return 4; // フォールバック値
            }

            // totalWidthはlabelSize = 4のとき画像横幅が300px程度になる想定
            // calculatorLabelはtargetPixelRatio: 2なので、実際の画像横幅は600px程度
            // ExpectedWidthは実際の画像での横幅予測値
            const ExpectedWidth = totalWidth * (this.width / 600);
            const ExpectedHeight = totalHeight * (this.width / 600);
            
            // 横幅と縦幅の両方を考慮してサイズを調整
            const targetWidth = this.width * 0.8;
            const targetHeight = (this.height - this.graphSize) * 0.8 - this.graphMargin;
            const autoSizeByWidth = 4 * (targetWidth / ExpectedWidth);
            const autoSizeByHeight = 4 * (targetHeight / ExpectedHeight);
            
            // 横幅と縦幅の制約のうち、より厳しい方（小さい方）を採用
            const autoSize = Math.min(autoSizeByWidth, autoSizeByHeight);
            console.log(totalHeight, totalWidth, ExpectedHeight, ExpectedWidth);
            
            console.log(`Auto size calculation: width=${autoSizeByWidth.toFixed(2)}, height=${autoSizeByHeight.toFixed(2)}, final=${autoSize.toFixed(2)}`);
            
            // 最小値1、最大値4で制限
            const result = Math.max(1, Math.min(4, autoSize));
            return result;
        } catch (error) {
            console.warn('Auto label size calculation failed:', error);
            return 4; // エラー時はデフォルト値
        }
    }

    generate() {
        // カスタム画像サイズの場合は専用の値を取得
        let dimensionValue = this.app.imageDimension.value;
        if (dimensionValue === 'custom') {
            const customValue = this.app.getCustomDimensionValue();
            if (!customValue) {
                alert('カスタム画像サイズが正しく入力されていません。幅と高さを100-10000の範囲で入力してください。');
                return;
            }
            dimensionValue = customValue;
        }

        [this.width, this.height, this.graphSize, this.graphMargin, this.labelPos] = dimensionValue.split(',').map(num => +num);
        this.fillColor = this.app.color.value;

        this.generatePNG();
        this.generateSVG();
    }

    /**
     * PNG画像をbase64形式で生成して返す（プレビューには表示しない）
     * @returns {Promise<string>} base64形式の画像データ
     */
    generatePNGBase64() {
        return new Promise((resolve) => {
            // カスタム画像サイズの場合は専用の値を取得
            let dimensionValue = this.app.imageDimension.value;
            if (dimensionValue === 'custom') {
                const customValue = this.app.getCustomDimensionValue();
                if (!customValue) {
                    resolve(null);
                    return;
                }
                dimensionValue = customValue;
            }

            [this.width, this.height, this.graphSize, this.graphMargin, this.labelPos] = dimensionValue.split(',').map(num => +num);
            this.fillColor = this.app.color.value;

            const graphImg = new Image();
            const mergeImg = new Image();
            const fullCaptureImg = new Image();
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = this.width;
            canvas.height = this.height;

            const is2D = document.querySelector('input[name="version"]:checked').value === 'version-2d';
            Promise.all([
                new Promise(resolveImg => (graphImg.onload = resolveImg)),
                new Promise(resolveImg => (mergeImg.onload = resolveImg)),
                new Promise(resolveImg => (fullCaptureImg.onload = resolveImg))
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

                // base64データを返す
                const imgSrc = this.app.fullCapture.checked ? fullCaptureImg.src : canvas.toDataURL();
                resolve(imgSrc);
            });

            const calculator = is2D ? this.app.calculator2D : this.app.calculator3D;
            graphImg.src = calculator.screenshot({
                width: 320 * (this.app.widegraph.checked + 1),
                height: 320,
                targetPixelRatio: this.graphSize / 320
            });

            const label = this.app.getLabel(calculator);
            const ratio = (Math.min(this.width, this.height) >= 360) + 1;
            console.log(label);
            
            // CalculatorLabelScreenshotを設定・実行する共通処理
            const setupCalculatorLabel = (labelSize) => {
                this.app.calculatorLabelScreenshot.setExpression({
                    id: 'label',
                    latex: `\\left(0,-${this.labelPos / ratio}\\right)`,
                    color: 'black',
                    label: `\`${this.app.labelFont.value ? `\\${this.app.labelFont.value}{${label}}` : label}\``,
                    hidden: true,
                    showLabel: true,
                    secret: true,
                    labelSize: labelSize * this.labelPos + '/' + 720 * ratio
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
            };

            // AutoサイズかどうかをチェックしてlabelSizeを決定
            let effectiveLabelSize = this.app.labelSize.value;

            if (this.app.labelSize.disabled) { // labelSize = auto
                // PNG生成時にDesmosのDOM要素からautoサイズを計算
                setupCalculatorLabel(this.calculateAutoLabelSize());
            } else {
                effectiveLabelSize = parseFloat(effectiveLabelSize);
                setupCalculatorLabel(effectiveLabelSize);
            }

            fullCaptureImg.src = calculator.screenshot({
                width: this.width,
                height: this.height
            });
        });
    }

    generatePNG() {
        // generatePNGBase64を使用してbase64データを取得
        this.generatePNGBase64().then(imgSrc => {
            // プレビューとダウンロードリンクにセット
            this.app.downloadPNG.href = this.app.preview.src = imgSrc;
            this.app.preview.style.maxWidth = this.width + 'px';
            this.app.containerElt.style.display = 'block';
        }).catch(error => {
            console.error('PNG生成エラー:', error);
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

            // mathjaxで(pathで描かれた)latexを追加
            const label = this.app.getLabel(calculator, 'svg', this.app.labelFont.value);
            this.app.mathjaxPreview.innerHTML = `\\( ${label} \\)`;
            return MathJax.typesetPromise([this.app.mathjaxPreview]).then(() => {
                // 生成したmathjaxのタグを取得後 下のsvgを操作
                // <mjx-container>
                //   <svg>
                //     <defs>...</defs>
                //     <g>...</g>
                //   </svg>
                // </mjx-container>
                const mathjaxElement = document.getElementsByTagName('mjx-container')[0].childNodes[0]
                const svgElements = mathjaxElement.childNodes;
                
                // AutoサイズかどうかをチェックしてlabelSizeを決定
                let effectiveLabelSize = this.app.labelSize.value;
                if (effectiveLabelSize === 'auto') {
                    effectiveLabelSize = this.calculateAutoLabelSize();
                    console.log(`Auto label size calculated: ${effectiveLabelSize}`);
                } else {
                    effectiveLabelSize = parseFloat(effectiveLabelSize);
                }
                
                const defaultSvgWidth = 8 * 54.5 * parseFloat(mathjaxElement.getAttribute('width')); // defaulでの横幅pxサイズ (8px/1em, x5.45 = fontSize:4)
                const svgScale = 0.065 * (effectiveLabelSize / 4) * (this.labelPos / 720); // default=4, 0.065調整
                const svgWidth = defaultSvgWidth * svgScale;
                const svgLeft = (this.width - svgWidth) >> 1;
                const svgMargin = (1000 * svgScale + this.height + this.labelPos) >> 1; // 1000*svgScale = 1行の高さ height+labelPos = 1行目の位置
                const labelColor = ColorUtils.contrast(this.app.color.value);

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
                this.app.svgPreview.appendChild(SVGcanvas);

                return asyncScreenshot({
                    format: 'svg',
                    width: this.width,
                    height: this.height
                });
            });
        }).then(s => {
            // fullCaptureSvg
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
