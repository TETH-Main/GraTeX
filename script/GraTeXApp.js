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

        this.calcElt3D = document.getElementById('calculator-3d');
        this.calculator3D = Desmos.Calculator3D(this.calcElt3D, {
            border: false,
            pasteGraphLink: true
        });
        this.calculator3D.setExpression({ latex: 'x^2+y^2+z^2=10' });

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

        // 設定の自動ロード（初期化完了後に実行）
        setTimeout(() => this._autoLoadSettings(), 100);

        // 設定の自動保存イベントを追加
        this._setupAutoSave();
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

        // カスタム画像サイズ関連要素
        this.customDimensionInputs = document.getElementById('custom-dimension-inputs');
        this.customWidth = document.getElementById('custom-width');
        this.customHeight = document.getElementById('custom-height');

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

        // this.calc3DElt.onload = () => {
        //     this.calculator3D = this.calc3DElt.contentWindow.Calc;
        // };

        document.querySelectorAll('input[name="label"]').forEach(element => {
            element.addEventListener('change', event => {
                this.calcLabelElt.style.display = event.target.value === 'custom' ? '' : 'none';
            });
        });

        // カスタム画像サイズのイベントリスナー
        this.imageDimension.addEventListener('change', (event) => {
            this.toggleCustomDimensionInputs(event.target.value === 'custom');
        });

        // カスタム入力フィールドのバリデーション
        [this.customWidth, this.customHeight].forEach(input => {
            input.addEventListener('input', () => {
                this.validateCustomDimensions();
            });
        });
    }

    getUrlQueries() {
        return Object.fromEntries(
            Array.from(new URLSearchParams(location.search), ([key, value]) => [key.toLowerCase(), value || true])
        );
    }

    importGraph(hash) {
        if (!hash) return;

        let url = hash;

        const is2D = this.is2DCalculatorActive();
        if (!hash.startsWith('https://')) {
            if (is2D) url = `https://www.desmos.com/calculator/${hash}`;
            else url = `https://www.desmos.com/3d/${hash}`;
        }

        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', url);
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: clipboardData
        });

        const exprArea = (is2D ? this.calcElt : this.calc3DElt).querySelector('.dcg-expressionarea, .dcg-mq-root-block, [role="textbox"]');
        if (exprArea) {
            this.getActiveCalculator().openKeypad();
            exprArea.dispatchEvent(pasteEvent);
        } else {
            // 見つからない場合はフォールバックでloadGraphを使う
            // const match =
            //     /^\s*(?:https?:\/\/)?(?:[-a-zA-Z0-9]*\.)?desmos\.com(?:\:[0-9]+)?\/(calculator|3d)\/([^?#\/\s]+)/.exec(hash);
            // if (match) this.loadGraph(match[2], match[1] === 'calculator');
            // else this.loadGraph(hash, is2D);
        }
    }

    loadGraph(hash, is2D) {
        let url = is2D
            ? 'https://saved-work.desmos.com/calc-states/production/'
            : 'https://saved-work.desmos.com/calc-3d-states/production/';
        url += hash;

        fetch(url)
            .then(response => response.text())
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const data = doc.body.getAttribute('data-load-data');
                // dataはJSON文字列なので、必要ならJSON.parse
                const json = JSON.parse(data.replace(/'/g, '"'));
                const graphStateUrl = json.graph.stateUrl;
                return fetch(graphStateUrl);
            })
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

    // カスタム画像サイズ入力フィールドの表示/非表示を切り替える
    toggleCustomDimensionInputs(show) {
        this.customDimensionInputs.style.display = show ? 'block' : 'none';
        if (show) {
            // カスタムを選択するたびに最新のビューポートサイズを取得して設定
            this.setDefaultCustomDimensions();
        }
    }

    // デフォルトのカスタム画像サイズを設定
    setDefaultCustomDimensions() {
        // ブラウザのビューポートサイズを取得
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        this.customWidth.value = viewportWidth;
        this.customHeight.value = viewportHeight;
        
        console.log(`ビューポートサイズ ${viewportWidth}x${viewportHeight} をカスタムサイズに設定しました`);
    }

    // カスタム画像サイズのバリデーション
    validateCustomDimensions() {
        const width = parseInt(this.customWidth.value);
        const height = parseInt(this.customHeight.value);
        
        let isValid = true;
        
        // 幅のバリデーション
        if (isNaN(width) || width < 100 || width > 10000) {
            this.customWidth.style.borderColor = '#dc3545';
            this.customWidth.style.borderWidth = '3px';
            isValid = false;
        } else {
            this.customWidth.style.borderColor = '#ced4da';
            this.customWidth.style.borderWidth = '1px';
        }
        
        // 高さのバリデーション
        if (isNaN(height) || height < 100 || height > 10000) {
            this.customHeight.style.borderColor = '#dc3545';
            this.customHeight.style.borderWidth = '3px';
            isValid = false;
        } else {
            this.customHeight.style.borderColor = '#ced4da';
            this.customHeight.style.borderWidth = '1px';
        }
        
        return isValid;
    }

    // カスタム画像サイズの値を取得（CSV形式）
    getCustomDimensionValue() {
        const width = parseInt(this.customWidth.value);
        const height = parseInt(this.customHeight.value);
        
        if (isNaN(width) || isNaN(height)) {
            return null;
        }
        
        // グラフサイズとマージンを画像サイズに基づいて計算
        const graphSize = Math.min(width, height) * 0.6; // 画像サイズの60%をグラフサイズとする
        const margin = Math.max(32, graphSize * 0.15); // マージンはグラフサイズの15%、最小32px
        const labelPos = height * 0.67; // ラベル位置は高さの67%の位置
        
        return `${width},${height},${Math.round(graphSize)},${Math.round(margin)},${Math.round(labelPos)}`;
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

    // ======================
    // GraTeX API - Settings Management
    // ======================

    /**
     * 現在の設定を取得する
     * @returns {Object} 現在の設定オブジェクト
     */
    getSettings() {
        const settings = {
            label: this.getCurrentLabelValue(),
            labelFont: this.labelFont.value,
            labelSize: this.labelSize.value,
            addFrame: this.frame.checked,
            wideGraph: this.widegraph.checked,
            addCredit: this.credit.checked,
            graphOnly: this.graphOnly.checked,
            fullCapture: this.fullCapture.checked,
            backgroundColor: this.color.value,
            imageDimension: this.imageDimension.value
        };

        // カスタム画像サイズの場合は値も保存
        if (this.imageDimension.value === 'custom') {
            settings.customWidth = this.customWidth.value;
            settings.customHeight = this.customHeight.value;
        }

        return settings;
    }

    /**
     * 設定を適用する
     * @param {Object} settings - 適用する設定オブジェクト
     */
    applySettings(settings) {
        if (!settings || typeof settings !== 'object') {
            console.error('GraTeX API: Invalid settings object');
            return false;
        }

        try {
            // Label設定
            if (settings.label && ['hide', 'top-expression', 'custom'].includes(settings.label)) {
                this.setLabelRadioValue(settings.label);
            }

            // Label Font設定
            if (settings.labelFont !== undefined) {
                // 空文字の場合は明示的に空文字を設定してDefaultが選択されるようにする
                this.labelFont.value = settings.labelFont || '';
            }

            // Label Size設定
            if (settings.labelSize !== undefined) {
                this.labelSize.value = settings.labelSize;
            }

            // Boolean設定（チェックボックス）
            if (settings.addFrame !== undefined) {
                this.frame.checked = Boolean(settings.addFrame);
            }
            if (settings.wideGraph !== undefined) {
                this.widegraph.checked = Boolean(settings.wideGraph);
            }
            if (settings.addCredit !== undefined) {
                this.credit.checked = Boolean(settings.addCredit);
            }
            if (settings.graphOnly !== undefined) {
                this.graphOnly.checked = Boolean(settings.graphOnly);
            }
            if (settings.fullCapture !== undefined) {
                this.fullCapture.checked = Boolean(settings.fullCapture);
            }

            // Background Color設定
            if (settings.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(settings.backgroundColor)) {
                this.color.value = settings.backgroundColor;
            }

            // Image Dimension設定
            if (settings.imageDimension !== undefined) {
                // 有効な選択肢かチェック
                const validOptions = Array.from(this.imageDimension.options).map(opt => opt.value);
                if (validOptions.includes(settings.imageDimension)) {
                    this.imageDimension.value = settings.imageDimension;
                    
                    // カスタム画像サイズの場合は入力フィールドも復元
                    if (settings.imageDimension === 'custom') {
                        this.toggleCustomDimensionInputs(true);
                        if (settings.customWidth) {
                            this.customWidth.value = settings.customWidth;
                        }
                        if (settings.customHeight) {
                            this.customHeight.value = settings.customHeight;
                        }
                    } else {
                        this.toggleCustomDimensionInputs(false);
                    }
                }
            }

            console.log('GraTeX API: Settings applied successfully');
            return true;
        } catch (error) {
            console.error('GraTeX API: Error applying settings:', error);
            return false;
        }
    }

    /**
     * 特定の設定項目を更新する
     * @param {string} key - 設定項目のキー
     * @param {*} value - 設定する値
     */
    setSetting(key, value) {
        const settings = {};
        settings[key] = value;
        return this.applySettings(settings);
    }

    /**
     * 特定の設定項目を取得する
     * @param {string} key - 設定項目のキー
     * @returns {*} 設定値
     */
    getSetting(key) {
        const settings = this.getSettings();
        return settings[key];
    }

    /**
     * 設定をリセットする（デフォルト値に戻す）
     */
    resetSettings() {
        const defaultSettings = {
            label: 'top-expression',
            labelFont: '',
            labelSize: '4',
            addFrame: true,
            wideGraph: false,
            addCredit: false,
            graphOnly: false,
            fullCapture: false,
            backgroundColor: '#FFFFFF',
            imageDimension: '1920,1080,640,96,720'
        };
        return this.applySettings(defaultSettings);
    }

    /**
     * 設定の有効な値の一覧を取得する
     * @returns {Object} 各設定項目の有効な値の一覧
     */
    getValidSettingsValues() {
        return {
            label: ['hide', 'top-expression', 'custom'],
            labelFont: ['', 'mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt'],
            labelSize: ['1', '2', '2.5', '3', '4', '6', '8', 'auto'],
            addFrame: [true, false],
            wideGraph: [true, false],
            addCredit: [true, false],
            graphOnly: [true, false],
            fullCapture: [true, false],
            backgroundColor: 'Hex color code (e.g., #FFFFFF)',
            imageDimension: Array.from(this.imageDimension.options).map(opt => opt.value)
        };
    }

    // ======================
    // GraTeX API - Settings Storage
    // ======================

    /**
     * 設定を独自圧縮形式でエンコードする
     * @param {Object} settings - 設定オブジェクト
     * @returns {string} 圧縮された設定文字列
     */
    _encodeSettings(settings) {
        // 設定項目を短縮記号にマッピング
        const mapping = {
            label: 'l',
            labelFont: 'f',
            labelSize: 's',
            addFrame: 'r',
            wideGraph: 'w',
            addCredit: 'c',
            graphOnly: 'g',
            fullCapture: 'u',
            backgroundColor: 'b',
            imageDimension: 'd'
        };

        // 値を短縮形式にマッピング
        const valueMapping = {
            // label values
            'hide': 'h',
            'top-expression': 't',
            'custom': 'c',
            // labelFont values
            '': '0',
            'mathrm': '1',
            'mathit': '2',
            'mathbf': '3',
            'mathsf': '4',
            'mathtt': '5',
            // labelSize values (そのまま使用)
            // boolean values
            'true': '1',
            'false': '0',
            // backgroundColor - #を削除して6桁のみ
            // imageDimension - インデックス番号を使用
        };

        const imageDimOptions = Array.from(this.imageDimension.options).map(opt => opt.value);
        
        let encoded = '';
        
        Object.entries(settings).forEach(([key, value]) => {
            const shortKey = mapping[key];
            if (!shortKey) return;
            
            let shortValue = '';
            
            switch (key) {
                case 'label':
                case 'labelFont':
                    shortValue = valueMapping[value] || value;
                    break;
                case 'labelSize':
                    shortValue = value;
                    break;
                case 'addFrame':
                case 'wideGraph':
                case 'addCredit':
                case 'graphOnly':
                case 'fullCapture':
                    shortValue = value ? '1' : '0';
                    break;
                case 'backgroundColor':
                    // #FFFFFFを6桁の16進数のみに短縮
                    shortValue = value.replace('#', '').toUpperCase();
                    break;
                case 'imageDimension':
                    // 選択肢のインデックスを使用
                    const index = imageDimOptions.indexOf(value);
                    shortValue = index >= 0 ? index.toString() : '0';
                    break;
            }
            
            encoded += shortKey + shortValue + '|';
        });
        
        // 末尾の|を削除
        return encoded.slice(0, -1);
    }

    /**
     * 圧縮された設定文字列をデコードする
     * @param {string} encoded - 圧縮された設定文字列
     * @returns {Object} 設定オブジェクト
     */
    _decodeSettings(encoded) {
        const reverseMapping = {
            'l': 'label',
            'f': 'labelFont',
            's': 'labelSize',
            'r': 'addFrame',
            'w': 'wideGraph',
            'c': 'addCredit',
            'g': 'graphOnly',
            'u': 'fullCapture',
            'b': 'backgroundColor',
            'd': 'imageDimension'
        };

        const reverseValueMapping = {
            // label values
            'h': 'hide',
            't': 'top-expression',
            'c': 'custom',
            // labelFont values
            '0': '',
            '1': 'mathrm',
            '2': 'mathit',
            '3': 'mathbf',
            '4': 'mathsf',
            '5': 'mathtt'
        };

        const imageDimOptions = Array.from(this.imageDimension.options).map(opt => opt.value);
        const settings = {};
        
        const pairs = encoded.split('|');
        pairs.forEach(pair => {
            if (pair.length < 2) return;
            
            const shortKey = pair[0];
            const shortValue = pair.slice(1);
            const key = reverseMapping[shortKey];
            
            if (!key) return;
            
            let value;
            
            switch (key) {
                case 'label':
                case 'labelFont':
                    value = reverseValueMapping[shortValue] !== undefined ? reverseValueMapping[shortValue] : shortValue;
                    // labelFontの場合、undefinedや不正な値は空文字にフォールバック
                    if (key === 'labelFont' && value === undefined) {
                        value = '';
                    }
                    break;
                case 'labelSize':
                    value = shortValue;
                    break;
                case 'addFrame':
                case 'wideGraph':
                case 'addCredit':
                case 'graphOnly':
                case 'fullCapture':
                    value = shortValue === '1';
                    break;
                case 'backgroundColor':
                    // 6桁の16進数に#を追加
                    value = '#' + shortValue;
                    break;
                case 'imageDimension':
                    // インデックスから実際の値を取得
                    const index = parseInt(shortValue, 10);
                    value = imageDimOptions[index] || imageDimOptions[0];
                    break;
                default:
                    value = shortValue;
            }
            
            settings[key] = value;
        });
        
        return settings;
    }

    /**
     * 設定をローカルストレージに保存する
     * @param {string} name - 設定プリセット名（省略時は'default'）
     * @returns {boolean} 保存成功時はtrue
     */
    saveSettings(name = 'default') {
        try {
            const settings = this.getSettings();
            const encoded = this._encodeSettings(settings);
            const storageKey = `gratex_settings_${name}`;
            
            localStorage.setItem(storageKey, encoded);
            localStorage.setItem('gratex_last_saved', name);
            
            console.log(`GraTeX API: Settings saved as '${name}' (${encoded.length} chars)`);
            return true;
        } catch (error) {
            console.error('GraTeX API: Error saving settings:', error);
            return false;
        }
    }

    /**
     * ローカルストレージから設定をロードする
     * @param {string} name - 設定プリセット名（省略時は'default'）
     * @returns {boolean} ロード成功時はtrue
     */
    loadSettings(name = 'default') {
        try {
            const storageKey = `gratex_settings_${name}`;
            const encoded = localStorage.getItem(storageKey);
            
            if (!encoded) {
                console.warn(`GraTeX API: No settings found for '${name}'`);
                return false;
            }
            
            const settings = this._decodeSettings(encoded);
            const success = this.applySettings(settings);
            
            if (success) {
                console.log(`GraTeX API: Settings loaded from '${name}'`);
                localStorage.setItem('gratex_last_loaded', name);
            }
            
            return success;
        } catch (error) {
            console.error('GraTeX API: Error loading settings:', error);
            return false;
        }
    }

    /**
     * 保存されている設定プリセット一覧を取得する
     * @returns {Array} 設定プリセット名の配列
     */
    getSavedSettingsNames() {
        const names = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gratex_settings_')) {
                const name = key.replace('gratex_settings_', '');
                names.push(name);
            }
        }
        return names.sort();
    }

    /**
     * 設定プリセットを削除する
     * @param {string} name - 削除する設定プリセット名
     * @returns {boolean} 削除成功時はtrue
     */
    deleteSettings(name) {
        if (!name || name === 'default') {
            console.warn('GraTeX API: Cannot delete default settings');
            return false;
        }
        
        try {
            const storageKey = `gratex_settings_${name}`;
            const existed = localStorage.getItem(storageKey) !== null;
            localStorage.removeItem(storageKey);
            
            if (existed) {
                console.log(`GraTeX API: Settings '${name}' deleted`);
            } else {
                console.warn(`GraTeX API: Settings '${name}' not found`);
            }
            
            return existed;
        } catch (error) {
            console.error('GraTeX API: Error deleting settings:', error);
            return false;
        }
    }

    /**
     * 現在の設定をクリップボードにエクスポートする
     * @returns {boolean} エクスポート成功時はtrue
     */
    async exportSettings() {
        try {
            const settings = this.getSettings();
            const encoded = this._encodeSettings(settings);
            await navigator.clipboard.writeText(encoded);
            console.log('GraTeX API: Settings exported to clipboard');
            return true;
        } catch (error) {
            console.error('GraTeX API: Error exporting settings:', error);
            return false;
        }
    }

    /**
     * クリップボードから設定をインポートする
     * @returns {boolean} インポート成功時はtrue
     */
    async importSettings() {
        try {
            const encoded = await navigator.clipboard.readText();
            const settings = this._decodeSettings(encoded);
            const success = this.applySettings(settings);
            
            if (success) {
                console.log('GraTeX API: Settings imported from clipboard');
            }
            
            return success;
        } catch (error) {
            console.error('GraTeX API: Error importing settings:', error);
            return false;
        }
    }

    /**
     * アプリ起動時に自動的に前回の設定をロードする
     */
    _autoLoadSettings() {
        const lastLoaded = localStorage.getItem('gratex_last_loaded') || 'default';
        if (this.getSavedSettingsNames().includes(lastLoaded)) {
            this.loadSettings(lastLoaded);
        } else {
            // 保存済み設定がない場合はデフォルト設定を明示的に適用
            this.resetSettings();
        }
    }

    /**
     * 自動保存のイベントリスナーを設定する
     */
    _setupAutoSave() {
        // ページを閉じる/リロードする前に設定を保存
        window.addEventListener('beforeunload', () => {
            this.saveSettings();
        });

        // ページの可視性が変更されたとき（他のタブに切り替えるときなど）に設定を保存
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveSettings();
            }
        });

        // 設定が変更されたときに自動保存（デバウンス処理付き）
        this._setupSettingsChangeListener();
    }

    /**
     * 設定変更の監視と自動保存を設定する
     */
    _setupSettingsChangeListener() {
        let saveTimeout;
        
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveSettings();
            }, 1000); // 1秒後に保存
        };

        // チェックボックスの変更を監視
        [this.frame, this.widegraph, this.credit, this.graphOnly, this.fullCapture].forEach(element => {
            element.addEventListener('change', debouncedSave);
        });

        // セレクトボックスの変更を監視
        [this.labelFont, this.labelSize, this.imageDimension].forEach(element => {
            element.addEventListener('change', debouncedSave);
        });

        // カスタム画像サイズ入力フィールドの変更を監視
        [this.customWidth, this.customHeight].forEach(element => {
            element.addEventListener('input', debouncedSave);
        });

        // カラーピッカーの変更を監視
        this.color.addEventListener('change', debouncedSave);

        // ラジオボタンの変更を監視
        document.querySelectorAll('input[name="label"]').forEach(element => {
            element.addEventListener('change', debouncedSave);
        });
    }
}

// アプリケーションの起動
window.GraTeX = new GraTeXApp();
