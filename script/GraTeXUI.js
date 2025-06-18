// GraTeXUIクラス化
export class GraTeXUI {
    constructor(gratexApp) {
        this.gratexApp = gratexApp;
        this.MQ = null;
        this.movieStartField = null;
        this.movieEndField = null;
        this.movieStepField = null;

        this.init();
    }

    init() {
        const advancedButton = document.getElementById('advanced-options');
        const advancedMenu = document.getElementById('advanced-menu');
        if (advancedButton && advancedMenu) {
            advancedButton.addEventListener('click', function () {
                const isExpanded = advancedButton.getAttribute('aria-expanded') === 'true';
                advancedButton.setAttribute('aria-expanded', !isExpanded);
                advancedMenu.style.display = isExpanded ? 'none' : 'block';
            });
        }

        // タブ切り替え処理
        const tabLayout = document.getElementById('tab-layout');
        const tabMovie = document.getElementById('tab-movie');
        const layoutPanel = document.getElementById('layout-panel');
        const moviePanel = document.getElementById('movie-panel');

        const toggleMovieButtons = (enable) => {
            const gifButton = document.getElementById('downloadGIFButton');
            const mp4Button = document.getElementById('downloadMP4Button');
            if (gifButton) {
                gifButton.disabled = !enable;
                gifButton.style.display = 'inline-block';
                if (!enable) {
                    gifButton.classList.add('btn-disabled');
                    gifButton.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    };
                } else {
                    gifButton.classList.remove('btn-disabled');
                    gifButton.onclick = null;
                }
            }
            if (mp4Button) {
                mp4Button.disabled = !enable;
                mp4Button.style.display = 'inline-block';
                if (!enable) {
                    mp4Button.classList.add('btn-disabled');
                    mp4Button.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    };
                } else {
                    mp4Button.classList.remove('btn-disabled');
                    mp4Button.onclick = null;
                }
            }
        };

        if (tabLayout && tabMovie && layoutPanel && moviePanel) {
            tabLayout.addEventListener('click', () => {
                tabLayout.classList.add('active');
                tabMovie.classList.remove('active');
                layoutPanel.style.display = '';
                moviePanel.style.display = 'none';
                toggleMovieButtons(false);
            });
            tabMovie.addEventListener('click', () => {
                tabMovie.classList.add('active');
                tabLayout.classList.remove('active');
                layoutPanel.style.display = 'none';
                moviePanel.style.display = '';
                const hasFrames = this.gratexApp && this.gratexApp.movie && this.gratexApp.movie.frameImages && this.gratexApp.movie.frameImages.length > 0;
                toggleMovieButtons(hasFrames);
            });
        }

        this.MQ = window.MathQuill.getInterface(2);
        document.querySelectorAll('.movie-leq').forEach((el) => {
            this.MQ.StaticMath(el);
        });

        this.movieStartField = this.MQ.MathField(document.getElementById('movie-start'), {
            spaceBehavesLikeTab: true,
            leftRightIntoCmdGoes: 'up',
            restrictMismatchedBrackets: true,
            sumStartsWithNEquals: true,
            supSubsRequireOperand: true,
            charsThatBreakOutOfSupSub: '+-=<>',
            autoSubscriptNumerals: true,
            autoCommands: 'pi theta sqrt',
            autoOperatorNames: 'sin cos tan ln log'
        });
        this.movieEndField = this.MQ.MathField(document.getElementById('movie-end'), {
            spaceBehavesLikeTab: true,
            leftRightIntoCmdGoes: 'up',
            restrictMismatchedBrackets: true,
            sumStartsWithNEquals: true,
            supSubsRequireOperand: true,
            charsThatBreakOutOfSupSub: '+-=<>',
            autoSubscriptNumerals: true,
            autoCommands: 'pi theta sqrt',
            autoOperatorNames: 'sin cos tan ln log'
        });
        this.movieStepField = this.MQ.MathField(document.getElementById('movie-step'), {
            spaceBehavesLikeTab: true,
            leftRightIntoCmdGoes: 'up',
            restrictMismatchedBrackets: true,
            sumStartsWithNEquals: true,
            supSubsRequireOperand: true,
            charsThatBreakOutOfSupSub: '+-=<>',
            autoSubscriptNumerals: true,
            autoCommands: 'pi theta sqrt',
            autoOperatorNames: 'sin cos tan ln log'
        });
        this.movieStepField.latex('1');
        
        [this.movieStartField, this.movieEndField, this.movieStepField].forEach(field => {
            field.el().addEventListener('input', () => {
                if (this.gratexApp && this.gratexApp.movie) {
                    this.gratexApp.movie.updateGenerateButtonState();
                }
            });
        });

        const generateButton = document.getElementById('generate-movie-button');
        if (generateButton) {
            generateButton.addEventListener('click', () => {
                if (this.gratexApp && this.gratexApp.movie) {
                    this.gratexApp.movie.generateMovie();
                }
            });
        }
        const movieVarSelect = document.getElementById('movie-var');
        if (movieVarSelect) {
            movieVarSelect.addEventListener('change', () => {
                if (this.gratexApp && this.gratexApp.movie) {
                    this.gratexApp.movie.updateGenerateButtonState();
                }
            });
        }

        /**
         * Add Variable Label チェックボックスの処理
         * このチェックボックスがオンになったとき、
         *   現在のラベル値が 'top-expression' の場合、
         *     this.calculatorLabelに数式をセットする
         *     カスタムラベルのラジオボタンを選択状態にする。
         */
        const addVariableLabelCheckbox = document.getElementById('add-variable-label');
        if (addVariableLabelCheckbox) {
            addVariableLabelCheckbox.addEventListener('change', () => {
                if (addVariableLabelCheckbox.checked) {
                    const currentValue = this.gratexApp.getCurrentLabelValue();
                    if (currentValue === 'top-expression') {
                        // 数式をセットする
                        const latex = this.gratexApp.getLabel(this.gratexApp.getActiveCalculator());
                        this.gratexApp.calculatorLabel.setExpression({latex: latex});
                        this.gratexApp.setLabelRadioValue('custom');
                    }
                }
            });
        }
    }

    /**
     * 'start' | 'end' | 'step' を指定して該当MathFieldのlatexを返す
     */
    getMovieFieldLatex(type) {
        if (type === 'start') return this.movieStartField?.latex();
        if (type === 'end') return this.movieEndField?.latex();
        if (type === 'step') return this.movieStepField?.latex();
        return '';
    }
}
