/**
 * GraTeXのムービー生成機能
 */

// GifGeneratorとMp4Generatorをインポート
import { GifGenerator } from './GifGenerator.js';
import { Mp4Generator } from './Mp4Generator.js';

export class MovieGenerator {
    constructor() {
        this.animationVariables = {};
        this.updateInterval = null;
        this.changeEventHandler = null;
        this.graTexApp = null;
        this.gifGenerator = null;
        this.mp4Generator = null;
        this.frameImages = [];
        this.currentImageDimensions = null;
        this.isMoviePlaybackActive = false;
        this.moviePlaybackControls = null;
    }

    /**
     * GraTeXアプリの参照で初期化
     */
    async init(graTexApp) {
        this.graTexApp = graTexApp;
        
        // FFmpegを使わない独立したGifGeneratorとMp4Generatorを初期化
        this.gifGenerator = new GifGenerator();
        this.mp4Generator = new Mp4Generator();

        // GifGeneratorの初期化を待つ
        try {
            await this.gifGenerator.waitForReady();
            console.log('MovieGenerator: GifGenerator is ready');
        } catch (error) {
            console.warn('MovieGenerator: GifGenerator initialization failed:', error);
        }

        // Mp4Generatorの初期化を待つ
        try {
            await this.mp4Generator.waitForReady();
            console.log('MovieGenerator: Mp4Generator is ready');
        } catch (error) {
            console.warn('MovieGenerator: Mp4Generator initialization failed:', error);
        }

        this.startMonitoring();
    }

    /**
     * Desmos計算機からアニメーション変数を取得
     * @returns {Object} id -> 変数名 のマッピング
     */
    getAnimationVariables() {
        try {
            // 現在アクティブな計算機を取得
            const calculator = this.graTexApp?.getActiveCalculator();

            if (!calculator?.controller) {
                return {};
            }

            return Object.fromEntries(
                calculator.controller.listModel.__itemModelArray
                    .filter(e => e.sliderExists)
                    .map(e => [e.id, e.formula.assignment])
            );
        } catch (error) {
            console.warn('Failed to get animation variables:', error);
            return {};
        }
    }

    /**
     * 指定した変数IDの現在のスライダー値を取得
     * @param {string} variableId - 変数ID
     * @returns {number|null} 現在の値、なければnull
     */
    getCurrentSliderValue(variableId) {
        try {
            // 現在アクティブな計算機を取得
            const calculator = this.graTexApp?.getActiveCalculator();

            if (!calculator?.controller) {
                return null;
            }

            const item = calculator.controller.listModel.__itemModelArray.find(e => e.id === variableId);
            return item?.sliderExists ? item.formula?.typed_constant_value?.value : null;
        } catch (error) {
            console.warn('Failed to get slider value:', error);
            return null;
        }
    }

    /**
     * アンダースコア記法の変数名をMathQuill用のLaTeXサブスクリプト形式に変換
     * @param {string} varName - 例: "t_0"や"v_ar1"
     * @returns {string} LaTeXサブスクリプト形式
     */
    formatVariableName(varName) {
        // 例., "t_0" -> "t_{0}", "v_ar1" -> "v_{ar1}"
        return varName.replace(/_(.+)/, (match, subscript) => {
            return `_{${subscript}}`;
        });
    }

    /**
     * アニメーション変数のプルダウンを更新（カスタムMathQuillドロップダウンで表示）
     */
    updateVariableDropdown() {
        const dropdown = document.getElementById('movie-var');
        if (!dropdown) return;

        const newVariables = this.getAnimationVariables();

        // 変数が変更された場合は選択をリセット
        const variablesChanged = JSON.stringify(newVariables) !== JSON.stringify(this.animationVariables);
        
        if (!variablesChanged) {
            return;
        }

        this.animationVariables = newVariables;

        const currentValue = dropdown.value;

        dropdown.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select animation variable...';
        defaultOption.disabled = true;
        dropdown.appendChild(defaultOption);

        Object.entries(this.animationVariables).forEach(([id, varName]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = varName;
            option.setAttribute('data-latex', this.formatVariableName(varName));
            dropdown.appendChild(option);
        });

        // 2D/3D切り替えで変数が完全に変わった場合は選択をリセット
        if (currentValue && this.animationVariables[currentValue]) {
            dropdown.value = currentValue;
        } else {
            dropdown.selectedIndex = 0;
            // ムービーフレームもリセット（計算機が変わったため）
            if (variablesChanged && this.frameImages.length > 0) {
                this.resetGifImages();
            }
        }

        dropdown.disabled = Object.keys(this.animationVariables).length === 0;

        this.updateGenerateButtonState();

        this.setupDropdownEventListener(dropdown);

        setTimeout(() => {
            this.renderCustomDropdown(dropdown);
        }, 0);
    }

    /**
     * カスタムMathQuillドロップダウンを描画
     */
    renderCustomDropdown(dropdown) {
        // 既存のカスタムドロップダウンを削除
        let custom = document.getElementById('movie-var-mq');
        if (custom) custom.remove();

        if (typeof MathQuill === 'undefined') return;
        const MQ = MathQuill.getInterface(2);

        // ラッパー作成
        const wrapper = document.createElement('div');
        wrapper.id = 'movie-var-mq';
        wrapper.className = 'mq-dropdown-wrapper';

        // 表示用ボタン
        const display = document.createElement('button');
        display.type = 'button';
        display.className = 'mq-dropdown-display';

        // 現在の選択肢
        let selectedOption = dropdown.options[dropdown.selectedIndex];
        let latex = selectedOption && selectedOption.value
            ? selectedOption.getAttribute('data-latex')
            : '';
        let displaySpan = document.createElement('span');
        displaySpan.className = 'mq-dropdown-selected';
        if (latex) {
            MQ.StaticMath(displaySpan).latex(latex);
        } else {
            displaySpan.textContent = 'Select animation variable...';
            displaySpan.classList.add('mq-dropdown-placeholder');
        }
        display.appendChild(displaySpan);

        // ▼アイコン
        const arrow = document.createElement('span');
        arrow.className = 'mq-dropdown-arrow';
        arrow.innerHTML = '&#9660;';
        display.appendChild(arrow);

        // ドロップダウンリスト
        const list = document.createElement('div');
        list.className = 'mq-dropdown-list';

        // 各選択肢をリストに追加
        Array.from(dropdown.options).forEach((option, idx) => {
            const item = document.createElement('div');
            item.className = 'mq-dropdown-item' + (option.disabled ? ' mq-dropdown-item-disabled' : '');
            // MathQuillで描画
            if (option.value && option.getAttribute('data-latex')) {
                const span = document.createElement('span');
                MQ.StaticMath(span).latex(option.getAttribute('data-latex'));
                item.appendChild(span);
            } else {
                item.textContent = option.textContent;
            }
            // 選択時の処理
            item.addEventListener('click', () => {
                if (option.disabled) return;
                dropdown.value = option.value;
                // イベント発火
                dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                // 表示を更新
                displaySpan.innerHTML = '';
                if (option.value && option.getAttribute('data-latex')) {
                    MQ.StaticMath(displaySpan).latex(option.getAttribute('data-latex'));
                } else {
                    displaySpan.textContent = option.textContent;
                    displaySpan.classList.add('mq-dropdown-placeholder');
                }
                list.style.display = 'none';
            });
            list.appendChild(item);
        });

        // ボタンクリックでリスト表示
        display.addEventListener('click', () => {
            list.style.display = list.style.display === 'block' ? 'none' : 'block';
        });

        // 外部クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                list.style.display = 'none';
            }
        });

        wrapper.appendChild(display);
        wrapper.appendChild(list);

        // 元のselectを非表示
        dropdown.style.display = 'none';
        // 既存のカスタムドロップダウンがなければ挿入
        if (!dropdown.nextSibling || dropdown.nextSibling.id !== 'movie-var-mq') {
            dropdown.parentNode.insertBefore(wrapper, dropdown.nextSibling);
        }
    }

    /**
     * プルダウンの変更イベントリスナーをセットアップ（重複防止）
     */
    setupDropdownEventListener(dropdown) {
        if (this.dropdownChangeHandler) {
            dropdown.removeEventListener('change', this.dropdownChangeHandler);
        }

        this.dropdownChangeHandler = (event) => {
            const selectedId = event.target.value;
            if (selectedId) {
                const currentValue = this.getCurrentSliderValue(selectedId);
                if (currentValue !== null && currentValue !== undefined) {
                    this.graTexApp?.ui?.movieStartField.latex(currentValue.toString());
                }
            }
            this.updateGenerateButtonState();
        };

        dropdown.addEventListener('change', this.dropdownChangeHandler);
    }

    /**
     * 入力値の妥当性に応じて「Generate Movie」ボタンの状態を更新
     */
    updateGenerateButtonState() {
        const generateButton = document.getElementById('generate-movie-button');
        const dropdown = document.getElementById('movie-var');
        if (!generateButton || !dropdown) return;

        const hasVariable = dropdown.value && Object.keys(this.animationVariables).length > 0;

        // LaTeX数式を評価して数値化
        const startLatex = this.graTexApp?.ui?.getMovieFieldLatex?.('start');
        const endLatex = this.graTexApp?.ui?.getMovieFieldLatex?.('end');
        const stepLatex = this.graTexApp?.ui?.getMovieFieldLatex?.('step');
        const start = this.graTexApp?.evaluateLatex?.(startLatex, false);
        const end = this.graTexApp?.evaluateLatex?.(endLatex, false);
        const step = this.graTexApp?.evaluateLatex?.(stepLatex, false);

        // 数値判定
        const hasValidNumbers = start !== null && end !== null && step !== null && step !== 0;

        // start, end, step の関係チェック
        let validRange = false;
        if (hasValidNumbers) {
            if (step > 0) {
                validRange = start <= end;
            } else if (step < 0) {
                validRange = start >= end;
            }
        }

        generateButton.disabled = !hasVariable || !hasValidNumbers || !validRange;
    }
    
    /**
     * アニメーション変数の変化を監視開始
     */
    startMonitoring() {
        this.updateVariableDropdown();

        const calculator = this.graTexApp?.getActiveCalculator();
        if (calculator && typeof calculator.observeEvent === 'function') {
            this.changeEventHandler = () => {
                this.updateVariableDropdown();
            };

            calculator.observeEvent('change', this.changeEventHandler);
        }

        // 2D/3D切り替えイベントリスナーを追加
        document.querySelectorAll('input[name="version"]').forEach(element => {
            element.addEventListener('change', () => {
                this.stopMonitoring();
                setTimeout(() => {
                    this.updateVariableDropdown();
                    this.startMonitoring();
                }, 100);
            });
        });

        // 画像サイズ変更のリスナー追加
        const imageDimensionForm = document.forms.imageDimension;
        if (imageDimensionForm && imageDimensionForm.elements[0]) {
            imageDimensionForm.elements[0].addEventListener('change', () => {
                console.log('画像サイズが変更されました。GIF画像をリセットします');
                this.resetGifImages();
            });
        }
    }

    /**
     * アニメーション変数の監視を停止
     */
    stopMonitoring() {
        const calculator = this.graTexApp?.getActiveCalculator();
        if (calculator && typeof calculator.unobserveEvent === 'function' && this.changeEventHandler) {
            calculator.unobserveEvent('change', this.changeEventHandler);
            this.changeEventHandler = null;
        }

        this.isMoviePlaybackActive = false;
        this.moviePlaybackControls = null;
    }

    /**
     * 現在選択中のアニメーション変数情報を取得
     * @returns {Object|null} {id, name} またはnull
     */
    getSelectedVariable() {
        const dropdown = document.getElementById('movie-var');
        if (!dropdown || !dropdown.value) {
            return null;
        }

        return {
            id: dropdown.value,
            name: this.animationVariables[dropdown.value]
        };
    }

    /**
     * ムービー生成: start→endまでstepごとにDesmos上で変数値を更新し、コマ送りプレビューを表示
     */
    async generateMovie() {
        const selectedVar = this.getSelectedVariable();
        if (!selectedVar) {
            alert('Please select an animation variable');
            return;
        }

        const startValue = this.graTexApp?.ui?.getMovieFieldLatex?.('start');
        const endValue = this.graTexApp?.ui?.getMovieFieldLatex?.('end');
        const stepValue = this.graTexApp?.ui?.getMovieFieldLatex?.('step');
        const framerate = parseInt(document.getElementById('movie-framerate')?.value || 30, 10);

        if (!startValue || !endValue || !stepValue) {
            alert('Please fill in all animation parameters (start, end, and step values)');
            return;
        }

        const start = this.graTexApp.evaluateLatex(startValue, false);
        const end = this.graTexApp.evaluateLatex(endValue, false);
        const step = this.graTexApp.evaluateLatex(stepValue, false);
        if (start === null || end === null || step === null || step === 0) {
            alert('Start, end, and step must be valid numbers and step ≠ 0');
            return;
        }

        // 画像サイズが変更されていればリセット
        if (this.hasImageDimensionsChanged()) {
            console.log('画像サイズが変更されました。GIF画像をリセットします');
            this.resetGifImages();
        }

        // imageDimensionから画像サイズを取得
        const imageDimensionForm = document.forms.imageDimension;
        const imageDimensionValue = imageDimensionForm ? imageDimensionForm.elements[0].value : '1920,1080,640,96,720';
        const [imageWidth, imageHeight] = imageDimensionValue.split(',').map(num => parseInt(num, 10));

        this.updateCurrentImageDimensions();

        console.log(`Using image dimensions: ${imageWidth}x${imageHeight} from form: ${imageDimensionValue}`);        // プレビュー用のメイン画像とコントロール取得
        const generateContainer = document.getElementById('generate-container');
        generateContainer.style.display = 'block';

        const mainPreview = document.getElementById('preview');

        let controlsContainer = document.getElementById('movie-controls');
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'movie-controls';
            controlsContainer.className = 'movie-controls';
            const cardBody = generateContainer.querySelector('.card-body');
            const downloadButtons = cardBody.querySelector('.btn-download');
            cardBody.insertBefore(controlsContainer, downloadButtons);
        }
        controlsContainer.innerHTML = '';

        const generateButton = document.getElementById('generate-movie-button');
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.innerHTML = '<span>Generating...</span>';
        }

        try {
            let values = [];
            if (step > 0) {
                for (let v = start; v <= end + 1e-10; v += step) values.push(Number(v.toFixed(10)));
            } else {
                for (let v = start; v >= end - 1e-10; v += step) values.push(Number(v.toFixed(10)));
            }

            this.frameImages = [];

            let variableLabelChecked = document.getElementById('add-variable-label').checked;
            let variableLabelId = null;

            if (variableLabelChecked) {
                this.graTexApp.setVariableInLabel(selectedVar.name, '0');
            }
            variableLabelId = this.graTexApp.getVariableIdInLabel(selectedVar.name);

            for (let i = 0; i < values.length; ++i) {
                const v = values[i];
                this.graTexApp.updateVariableInCalculator(selectedVar.id, v);
                if(variableLabelChecked) {
                    this.graTexApp.updateVariableInLabel(variableLabelId, v);
                }
                console.log(`Set ${selectedVar.name} = ${v}`);

                // 描画が反映されるまで少し待つ
                await new Promise(res => setTimeout(res, 200));
                // スクリーンショット生成
                await new Promise(res => {
                    // GraTeXのPNG生成
                    this.graTexApp.utils.generate();
                    // 画像がセットされるまで監視
                    const preview = this.graTexApp.preview;
                    const onLoad = () => {
                        console.log(`フレーム${i}: 画像src生成:`, preview.src ? preview.src.substring(0, 50) + '...' : 'null');
                        if (preview.src && preview.src !== 'undefined' && preview.src.startsWith('data:image')) {
                            this.frameImages.push(preview.src);
                            console.log(`フレーム${i}: frameImagesに追加成功`);
                        } else {
                            console.warn(`フレーム${i}: 無効な画像src, スキップ:`, preview.src);
                        }
                        preview.removeEventListener('load', onLoad);
                        res();
                    };
                    // 既に画像が同じ場合もあるので、強制的にpush
                    if (preview.src && preview.src.startsWith('data:image')) {
                        console.log(`フレーム${i}: 既存画像src使用:`, preview.src.substring(0, 50) + '...');
                        this.frameImages.push(preview.src);
                        res();
                    } else {
                        preview.addEventListener('load', onLoad);
                    }
                });
            }

            console.log(`Generated ${this.frameImages.length} frames for preview`);
            console.log('First few frame URLs:', this.frameImages.slice(0, 3).map(url => url ? url.substring(0, 30) + '...' : 'null'));

            const img = mainPreview;
            let idx = 0;
            let playing = true;
            let timer = null; const showFrame = () => {
                if (this.frameImages.length === 0) {
                    console.warn('No frame images available');
                    pause();
                    return;
                }

                // インデックスが範囲外の場合は0にリセット
                if (idx >= this.frameImages.length || idx < 0) {
                    idx = 0;
                }

                // 有効なフレームを探す (最大でフレーム数分だけ試行)
                let attempts = 0;
                const maxAttempts = this.frameImages.length;

                while (attempts < maxAttempts) {
                    const frameUrl = this.frameImages[idx];
                    if (frameUrl && frameUrl !== 'undefined' && frameUrl.startsWith('data:image')) {
                        img.src = frameUrl;
                        return; // 成功したら終了
                    }

                    console.warn(`Frame ${idx} has invalid URL:`, frameUrl);
                    idx = (idx + 1) % this.frameImages.length;
                    attempts++;
                }

                // 全フレームが無効な場合は停止
                console.error('All frames have invalid URLs, stopping playback');
                pause();
            }; const play = () => {
                if (playing) return;
                playing = true;
                playLoop();
            };

            const pause = () => {
                playing = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            const playLoop = () => {
                if (!playing) return;
                showFrame();
                idx = (idx + 1) % this.frameImages.length;
                timer = setTimeout(playLoop, 1000 / framerate);
            };
            
            // 初期状態: 再生
            const startPreview = () => {
                if (this.frameImages.length === 0) {
                    console.error('No frames available for preview');
                    return;
                }

                // フレーム配列の有効性をチェック
                const validFrames = this.frameImages.filter(url =>
                    url && url !== 'undefined' && url.startsWith('data:image')
                );
                if (validFrames.length === 0) {
                    console.error('No valid frames available for preview');
                    mainPreview.src = '';
                    mainPreview.alt = 'Error: No valid frames generated. Please try again.';
                    return;
                }
                console.log(`Starting preview with ${validFrames.length} valid frames out of ${this.frameImages.length} total`);

                playing = true;
                playLoop();
            };

            this.moviePlaybackControls = {
                playing: () => playing,
                play: play,
                pause: pause,
                timer: () => timer
            };
            this.isMoviePlaybackActive = true;

            controlsContainer.classList.add('hidden');

            const setupPreviewClickHandler = () => {
                // 既存のクリックハンドラを削除
                if (mainPreview.movieClickHandler) {
                    mainPreview.removeEventListener('click', mainPreview.movieClickHandler);
                }
                mainPreview.movieClickHandler = () => {
                    if (playing) {
                        pause();
                    } else {
                        play();
                    }
                };
                mainPreview.addEventListener('click', mainPreview.movieClickHandler);
                mainPreview.style.cursor = 'pointer';
            };

            setupPreviewClickHandler();
            
            // 最初のフレーム表示＆再生開始
            showFrame();
            startPreview();

            this.showSaveButtons();

            console.log(`Generated ${this.frameImages.length} frames for animation`);
        } finally {
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.innerHTML = '<span>Generate Movie</span>';
                this.updateGenerateButtonState();
            }
        }
    }

    /**
     * 保存ボタンを表示し機能をセットアップ
     */
    showSaveButtons() {
        const generateContainer = document.getElementById('generate-container');
        const gifButton = document.getElementById('downloadGIFButton');
        const mp4Button = document.getElementById('downloadMP4Button');

        if (!generateContainer || !gifButton || !mp4Button) {
            console.error('Required elements not found');
            return;
        }

        generateContainer.style.display = 'block';
        gifButton.style.display = 'inline-block';
        mp4Button.style.display = 'inline-block';

        gifButton.disabled = false;
        mp4Button.disabled = false;
        gifButton.classList.remove('btn-disabled');
        mp4Button.classList.remove('btn-disabled');

        this.setupGIFButton(gifButton);

        this.setupMP4Button(mp4Button);
    }

    /**
     * GIFボタンの機能をセットアップ
     */
    setupGIFButton(gifButton) {
        // 現在の状態を保存
        const wasDisabled = gifButton.disabled;
        const hadDisabledClass = gifButton.classList.contains('btn-disabled');
        
        const newGifButton = gifButton.cloneNode(true);
        gifButton.parentNode.replaceChild(newGifButton, gifButton);
        
        // 以前の状態を復元
        newGifButton.disabled = wasDisabled;
        if (hadDisabledClass) {
            newGifButton.classList.add('btn-disabled');
        }
        
        newGifButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // ボタンが無効の場合は実行しない
            if (newGifButton.disabled) {
                e.stopPropagation();
                return false;
            }

            // プレビュー再生を停止
            this.stopMovieAnimation();

            if (this.frameImages.length === 0) {
                alert('まずムービーフレームを生成してください');
                return;
            }

            try {
                // 全ての保存ボタンを無効化
                this.disableAllSaveButtons();

                // 進捗表示を作成
                const progressContainer = this.createOrUpdateProgressDisplay('GIF生成中...');

                // GifGeneratorの準備確認
                if (!this.gifGenerator.isReady()) {
                    progressContainer.querySelector('#progress-percentage').textContent = '初期化中...';
                    await this.gifGenerator.waitForReady();
                }

                const framerate = parseInt(document.getElementById('movie-framerate')?.value || 30, 10);

                // 進捗コールバック設定
                this.gifGenerator.setProgressCallback((progress) => {
                    const percentage = Math.round(progress * 100);
                    const progressPercentage = document.getElementById('progress-percentage');
                    if (progressPercentage) {
                        progressPercentage.textContent = `${percentage}%`;
                    }
                });

                // GIF生成設定
                const delay = GifGenerator.fpsToDelay(framerate);
                const gifOptions = {
                    delay: delay,
                    quality: this.gifGenerator.getOptimalQuality(this.frameImages.length),
                    repeat: 0 // 無限ループ
                };

                console.log(`GIF生成: フレーム数${this.frameImages.length}, ${framerate}fps (${delay}ms delay)`);
                // GIF生成実行
                const gifBlob = await this.gifGenerator.generateFromBase64Array(this.frameImages, gifOptions);

                // ダウンロード
                this.gifGenerator.downloadGif(gifBlob, 'GraTeX_animation.gif');

                // 成功時の表示
                const progressDisplay = document.getElementById('progress-display-container');
                if (progressDisplay) {
                    progressDisplay.innerHTML = `
                        <div style="margin-bottom: 10px;">GIF生成完了！</div>
                        <div style="font-weight: bold; font-size: 18px; color: #4CAF50;">✅ ダウンロード完了</div>
                    `;
                }

                setTimeout(() => {
                    this.removeProgressDisplay();
                    this.enableAllSaveButtons();
                }, 2000);

            } catch (error) {
                console.error('GIF生成エラー:', error);
                alert('GIF生成に失敗しました: ' + error.message);

                // エラー時の表示
                const progressDisplay = document.getElementById('progress-display-container');
                if (progressDisplay) {
                    progressDisplay.innerHTML = `
                        <div style="margin-bottom: 10px;">GIF生成失敗</div>
                        <div style="font-weight: bold; font-size: 18px; color: #f44336;">❌ エラー</div>
                    `;
                }

                setTimeout(() => {
                    this.removeProgressDisplay();
                    this.enableAllSaveButtons();
                }, 3000);
            }
        });
    }

    /**
     * MP4ボタンの機能をセットアップ
     */
    setupMP4Button(mp4Button) {
        // 現在の状態を保存
        const wasDisabled = mp4Button.disabled;
        const hadDisabledClass = mp4Button.classList.contains('btn-disabled');
        
        const newMp4Button = mp4Button.cloneNode(true);
        mp4Button.parentNode.replaceChild(newMp4Button, mp4Button);

        // 以前の状態を復元
        newMp4Button.disabled = wasDisabled;
        if (hadDisabledClass) {
            newMp4Button.classList.add('btn-disabled');
        }

        newMp4Button.addEventListener('click', async (e) => {
            e.preventDefault();

            // ボタンが無効の場合は実行しない
            if (newMp4Button.disabled) {
                e.stopPropagation();
                return false;
            }

            // プレビュー再生を停止
            this.stopMovieAnimation();

            if (this.frameImages.length === 0) {
                alert('まずムービーフレームを生成してください');
                return;
            }

            try {
                // 全ての保存ボタンを無効化
                this.disableAllSaveButtons();

                // 進捗表示を作成
                const progressContainer = this.createOrUpdateProgressDisplay('MP4生成中...');

                // Mp4Generatorの準備確認
                if (!this.mp4Generator.isReady()) {
                    progressContainer.querySelector('#progress-percentage').textContent = '初期化中...';
                    await this.mp4Generator.waitForReady();
                }

                const framerate = parseInt(document.getElementById('movie-framerate')?.value || 30, 10);

                // 進捗コールバック設定
                this.mp4Generator.setProgressCallback((progress) => {
                    const percentage = Math.round(progress);
                    const progressPercentage = document.getElementById('progress-percentage');
                    if (progressPercentage) {
                        progressPercentage.textContent = `${percentage}%`;
                    }
                });                // MP4生成設定
                const delay = Math.round(1000 / framerate); // フレームレートからdelayを計算
                const mp4Options = {
                    delay: delay
                };

                console.log(`MP4生成: フレーム数${this.frameImages.length}, ${framerate}fps (${delay}ms delay)`);
                // MP4生成実行
                const mp4Blob = await this.mp4Generator.generateFromImages(this.frameImages, mp4Options);

                // ダウンロード
                this.mp4Generator.download(mp4Blob, 'GraTeX_animation');

                // 成功時の表示
                const progressDisplay = document.getElementById('progress-display-container');
                if (progressDisplay) {
                    progressDisplay.innerHTML = `
                        <div style="margin-bottom: 10px;">MP4生成完了！</div>
                        <div style="font-weight: bold; font-size: 18px; color: #4CAF50;">✅ ダウンロード完了</div>
                    `;
                }

                setTimeout(() => {
                    this.removeProgressDisplay();
                    this.enableAllSaveButtons();
                }, 2000);

            } catch (error) {
                console.error('MP4生成エラー:', error);
                alert('MP4生成に失敗しました: ' + error.message);

                // エラー時の表示
                const progressDisplay = document.getElementById('progress-display-container');
                if (progressDisplay) {
                    progressDisplay.innerHTML = `
                        <div style="margin-bottom: 10px;">MP4生成失敗</div>
                        <div style="font-weight: bold; font-size: 18px; color: #f44336;">❌ エラー</div>
                    `;
                }

                setTimeout(() => {
                    this.removeProgressDisplay();
                    this.enableAllSaveButtons();
                }, 3000);
            }
        });
    }

    /**
     * GIF生成画像とプレビューをリセット
     */
    resetGifImages() {
        this.frameImages = [];

        const previewContainer = document.getElementById('movie-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }

        const controlsContainer = document.getElementById('movie-controls');
        if (controlsContainer) {
            controlsContainer.classList.add('hidden');
            controlsContainer.innerHTML = '';
        }

        const mainPreview = document.getElementById('preview');
        const generateContainer = document.getElementById('generate-container');

        if (mainPreview) {
            mainPreview.src = '';
            mainPreview.alt = 'Preview';
            mainPreview.classList.remove('main-preview-active');
        }

        if (generateContainer) {
            generateContainer.style.display = 'none';
        }
        const downloadPNG = document.getElementById('downloadPNGButton');
        const downloadSVG = document.getElementById('downloadSVGButton');
        const downloadGIF = document.getElementById('downloadGIFButton');
        const downloadMP4 = document.getElementById('downloadMP4Button');

        if (downloadPNG) {
            downloadPNG.href = '';
        }

        if (downloadSVG) {
            downloadSVG.href = '';
        }

        if (downloadGIF) {
            downloadGIF.style.display = 'none';
            downloadGIF.disabled = false;
            downloadGIF.innerHTML = '<span>Save GIF</span>';
        }

        if (downloadMP4) {
            downloadMP4.style.display = 'none';
            downloadMP4.disabled = false;
            downloadMP4.innerHTML = '<span>Save MP4</span>';
        }

        this.removeProgressDisplay();

        this.isMoviePlaybackActive = false;
        this.moviePlaybackControls = null;

        this.updateCurrentImageDimensions();
        console.log('GIF生成画像・プレビュー・進捗表示をリセットしました');
    }

    /**
     * ムービーアニメーション再生を停止（現在再生中の場合のみ）
     */
    stopMovieAnimation() {
        if (!this.isMoviePlaybackActive || !this.moviePlaybackControls) {
            return;
        }

        try {
            if (this.moviePlaybackControls.playing()) {
                this.moviePlaybackControls.pause();
            }

            const mainPreview = document.getElementById('preview');
            if (mainPreview && mainPreview.movieClickHandler) {
                mainPreview.removeEventListener('click', mainPreview.movieClickHandler);
                mainPreview.movieClickHandler = null;
                mainPreview.style.cursor = 'default';
            }

            if (this.moviePlaybackControls.timer()) {
                clearInterval(this.moviePlaybackControls.timer());
            }

            this.isMoviePlaybackActive = false;
            this.moviePlaybackControls = null;

            console.log('Movie animation stopped successfully');
        } catch (error) {
            console.warn('Error stopping movie animation:', error);
            this.isMoviePlaybackActive = false;
            this.moviePlaybackControls = null;
        }
    }

    /**
     * フォームから現在の画像サイズを更新
     */
    updateCurrentImageDimensions() {
        const imageDimensionForm = document.forms.imageDimension;
        const imageDimensionValue = imageDimensionForm ? imageDimensionForm.elements[0].value : '1920,1080,640,96,720';
        const [imageWidth, imageHeight] = imageDimensionValue.split(',').map(num => parseInt(num, 10));

        this.currentImageDimensions = {
            width: imageWidth,
            height: imageHeight,
            fullValue: imageDimensionValue
        };

        console.log(`画像サイズを更新: ${imageWidth}x${imageHeight}`);
    }

    /**
     * 画像サイズが前回のムービー生成時から変更されたか判定
     */
    hasImageDimensionsChanged() {
        const imageDimensionForm = document.forms.imageDimension;
        const currentValue = imageDimensionForm ? imageDimensionForm.elements[0].value : '1920,1080,640,96,720';

        return this.currentImageDimensions === null ||
            this.currentImageDimensions.fullValue !== currentValue;
    }

    /**
     * 全ての保存ボタンを無効化
     */
    disableAllSaveButtons() {
        const saveButtons = [
            document.getElementById('downloadSVGButton'),
            document.getElementById('downloadPNGButton'),
            document.getElementById('downloadGIFButton'),
            document.getElementById('downloadMP4Button')
        ];

        saveButtons.forEach(button => {
            if (button) {
                button.disabled = true;
            }
        });
    }

    /**
     * 全ての保存ボタンを有効化
     */
    enableAllSaveButtons() {
        const saveButtons = [
            document.getElementById('downloadSVGButton'),
            document.getElementById('downloadPNGButton'),
            document.getElementById('downloadGIFButton'),
            document.getElementById('downloadMP4Button')
        ];

        saveButtons.forEach(button => {
            if (button) {
                button.disabled = false;
            }
        });
    }

    /**
     * 進捗表示を作成または更新
     */
    createOrUpdateProgressDisplay(message) {
        let progressContainer = document.getElementById('progress-display-container');

        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'progress-display-container';
            progressContainer.className = 'progress-display-container'; // クラス名を追加
            document.body.appendChild(progressContainer);
        }

        progressContainer.innerHTML = `
            <div style="margin-bottom: 10px;">${message}</div>
            <div id="progress-percentage" class="progress-percentage">0%</div>
        `;

        return progressContainer;
    }

    /**
     * 進捗表示を削除
     */
    removeProgressDisplay() {
        const progressContainer = document.getElementById('progress-display-container');
        if (progressContainer) {
            progressContainer.remove();
        }
    }
}
