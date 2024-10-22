import { markdownToHtml } from "./common.js";

/**
 * Represents a Graphical User Interface (GUI) element for building and
 * managing HTML elements with a focus on readability and maintainability.
 *
 * This class provides a convenient way to create and manipulate HTML elements
 * using a string specification or existing DOM elements. It also offers
 * methods for attaching event listeners and managing element relationships.
 */
class GuiElement {
  /**
   * @private
   * @type {Element}
   * The underlying DOM element associated with this GuiElement instance.
   */
  #element;
  /**
   * @private
   * @type {Object.<string, Function[]>}
   * A map of registered event names to their corresponding listener functions.
   */
  #events = {};
  #display = "block";

  /**
   * Creates a new GuiElement instance.
   *
   * @param {string|Element|GuiElement} source - The source for creating the
   *        element.
   *        - If a string is provided, it represents a specification for
   *          creating a new element.
   *        - If an Element is provided, it becomes the underlying element for
   *          this GuiElement.
   *        - If a GuiElement is provided, its element is transferred to this
   *          instance (ownership is moved).
   * @throws {TypeError} If the provided source is not a string, Element, or
   *         GuiElement.
   */
  constructor(source = "", role = "") {
    if (typeof source === "string") {
      this.#element = GuiElement.#specificationConstructor(source);
    } else if (source instanceof GuiElement) {
      this.#element = GuiElement.#moveConstructor(source);
    } else if (source instanceof Element) {
      this.#element = source;
    } else {
      throw new TypeError("`source` must be a string, Element, or GuiElement");
    }
    if (role) {
      this.#element.role = role;
    }
    this.#updateDisplay();
    this.show();
  }

  static create(source) {
    return new GuiElement(source);
  }

  static #moveConstructor(source) {
    const captured = source.element;
    source.element = undefined;
    return captured;
  }

  /**
   * Creates a new GuiElement instance from a string specification.
   *
   * @param {string} specification - A string specifying the element to create.
   *        The format is `tagName#id.class1.class2...`, where:
   *        - tagName (optional): The HTML tag name (e.g., "div", "span").
   *          Defaults to "div".
   *        - id (optional): An ID attribute for the element
   *          (e.g., "#myElement").
   *        - class (optional): One or more CSS classes separated by dots
   *          (e.g., ".error.important").
   * @throws {SyntaxError} If the provided specification is invalid.
   * @returns {Element} The newly created DOM element.
   * @private
   */
  static #specificationConstructor(specification) {
    const specifications = specification
      .split(" ")
      .filter((entry) => entry !== "");
    const attributes = specifications.map((specification) =>
      GuiElement.#parseSpecification(specification),
    );
    const elements = attributes.map((attribute) =>
      GuiElement.#createFromAttributes(...attribute),
    );
    const rootElement = elements[0];
    for (const element of elements.slice(1)) {
      rootElement.append(element);
    }
    return rootElement;
  }

  static #createFromAttributes(tagName, id, classes) {
    const element = document.createElement(tagName);
    if (id) {
      element.id = id;
    }
    element.classList.add(...classes);
    return element;
  }

  static #parseSpecification(specification) {
    const validPattern = /^(?:[a-z]+)?(?:#[a-z][\w-]*)?(?:\.[a-z][\w-]*)*$/;
    if (!validPattern.test(specification)) {
      throw new SyntaxError(`Invalid specification: "${specification}"`);
    }
    const pattern = /^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/;
    let [tagName, id, classSelector] = specification.match(pattern).slice(1);
    tagName = tagName || "div";
    id = id ?? "";
    const classNames = classSelector ? classSelector.split(".").slice(1) : [];
    return [tagName, id, classNames];
  }

  addClass(classSelector) {
    const classNames = classSelector ? classSelector.split(".").slice(1) : [];
    this.#element.classList.add(...classNames);
  }

  addEventListener(name, listener) {
    this.#throwIfNotRegistered(name);
    this.#events[name].push(listener);
  }

  after(source) {
    if (source === undefined) {
      // Clear all elements after this element
      let { nextSibling } = this.#element;
      while (nextSibling) {
        nextSibling.remove();
        ({ nextSibling } = this.#element);
      }
      return;
    }
    const elements = Array.isArray(source) ? source : [source];
    for (const element of elements) {
      this.#element.after(GuiElement.#getElement(element));
    }
  }

  append(source) {
    const elements = Array.isArray(source) ? source : [source];
    for (const element of elements) {
      this.#element.append(GuiElement.#getElement(element));
    }
  }

  attachEventObserver(name, observer) {
    this.addEventListener(name, (event) => {
      observer.dispatchEvent(event.name, event.parameters);
    });
  }

  before(source) {
    if (source === undefined) {
      // Clear all elements before this element
      let { previousSibling } = this.#element;
      while (previousSibling) {
        previousSibling.remove();
        ({ previousSibling } = this.#element);
      }
      return;
    }
    const elements = Array.isArray(source) ? source : [source];
    for (const element of elements) {
      this.#element.before(GuiElement.#getElement(element));
    }
  }

  clear() {
    this.#element.innerHTML = "";
  }

  dispatchEvent(name, parameters) {
    this.#throwIfNotRegistered(name);
    for (const listener of this.#events[name]) {
      listener({ name, parameters });
    }
  }

  entangleEvents(source, destination, selector) {
    const targets = selector
      ? this.#querySelectorAll(selector)
      : [this.#element];
    for (const target of targets) {
      target.addEventListener(source, (event) => {
        this.dispatchEvent(destination, event);
      });
    }
  }

  static #getElement(element) {
    if (element instanceof Element) {
      return element;
    }
    if (element instanceof GuiElement) {
      return element.element;
    }
    throw new TypeError(
      "`source` must contain only instances of Element or GuiElement",
    );
  }

  hide() {
    this.#updateDisplay();
    this.#element.style.display = "none";
  }

  querySelector(selector) {
    return GuiElement.create(this.#element.querySelector(selector));
  }

  querySelectorAll(selector) {
    const elements = this.#querySelectorAll(selector);
    return elements.map((element) => GuiElement.create(element));
  }

  #querySelectorAll(selector) {
    const elements = this.#element.querySelectorAll(selector);
    return [...elements];
  }

  registerEvent(name) {
    if (this.#isRegistered(name)) {
      throw new Error(`Event "${name}" already registered`);
    }
    this.#events[name] = [];
  }

  #isRegistered(name) {
    return name in this.#events;
  }

  #throwIfNotRegistered(name) {
    if (!this.#isRegistered(name)) {
      throw new Error(`Event "${name}" not registered`);
    }
  }

  static raiseIfNoTagname(selector) {
    if (!selector || selector[0] == "." || selector[0] == "#") {
      throw new SyntaxError("BaseButton selector must start with a tag name");
    }
  }

  static raiseIfHasTagname(selector) {
    if (selector && selector[0] != "." && selector[0] != "#") {
      throw new SyntaxError("Button selector must not start with a tag name");
    }
  }

  removeClass(classSelector) {
    const classNames = classSelector ? classSelector.split(".").slice(1) : [];
    this.#element.classList.remove(...classNames);
  }

  resize(width, height) {
    this.size = [width, height];
  }

  show() {
    this.#element.style.display = this.#display;
  }

  toggle() {
    if (this.visible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  #updateDisplay() {
    const computedStyle = globalThis.getComputedStyle(this.#element);
    if (computedStyle.display !== "none") {
      this.#display = computedStyle.display;
    }
  }

  visible() {
    return this.#element.style.display != "none";
  }

  get classes() {
    return [...this.#element.classList];
  }

  set classes(classes) {
    classes = Array.isArray(classes) ? classes : [classes];
    this.#element.classList.add(...classes);
  }

  get clientHeight() {
    return this.#element.clientHeight;
  }

  get clientWidth() {
    return this.#element.clientWidth;
  }

  get element() {
    return this.#element;
  }

  get height() {
    return this.#element.style.height;
  }

  set height(height) {
    this.#element.style.height =
      typeof height == "number" ? `${height}px` : height;
  }

  get html() {
    return this.#element.innerHTML;
  }

  set html(html) {
    if (typeof html != "string") {
      throw new TypeError("`text` must be a string");
    }
    this.#element.innerHTML = html;
  }

  set id(id) {
    this.#element.id = id;
  }

  get role() {
    return this.#element.role;
  }

  set role(role) {
    this.#element.role = role;
  }

  set size(size) {
    [this.width, this.height] = size;
  }

  get text() {
    return this.#element.textContent;
  }

  set text(text) {
    if (typeof text != "string") {
      throw new TypeError("`text` must be a string");
    }
    this.#element.textContent = text;
  }

  get width() {
    return this.#element.style.width;
  }

  set width(width) {
    this.#element.style.width = typeof width == "number" ? `${width}px` : width;
  }
}

// Simple elements

class FormInput extends GuiElement {
  constructor(type, selector = "") {
    BaseButton.raiseIfNoTagname(selector);
    super(selector);
    this.element.type = type;
  }

  get type() {
    return this.element.type;
  }

  get vale() {
    return this.element.value;
  }

  set value(value) {
    this.element.value = value;
  }
}

class BaseButton extends GuiElement {
  /**
   * Constructs a new BaseButton element.
   *
   * @param {string} text (Optional) The initial text content of the button.
   * @param {string} selector (Optional) An optional ID and zero or more CSS
   *        class names to apply to the button.
   */
  constructor(text = "", selector = "") {
    BaseButton.raiseIfNoTagname(selector);
    super(selector);
    this.text = text;
  }
}

class Button extends BaseButton {
  /**
   * Constructs a new Button element.
   *
   * @param {string} text (Optional) The initial text content of the button.
   * @param {string} selector (Optional) An optional ID and zero or more CSS
   *        class names to apply to the button.
   */
  constructor(text = "", selector = "") {
    BaseButton.raiseIfHasTagname(selector);
    super(text, `button${selector}`);
  }
}

class LinkButton extends BaseButton {
  /**
   * Constructs a new Button element.
   *
   * @param {string} text (Optional) The initial text content of the button.
   * @param {string} selector (Optional) An optional ID and zero or more CSS
   *        class names to apply to the button.
   */
  constructor(text = "", selector = "") {
    BaseButton.raiseIfHasTagname(selector);
    super(text, `a${selector}`);
  }
}

class Datepicker extends FormInput {
  constructor(date = new Date(), selector = "") {
    if (typeof date === "string") {
      selector = date;
      date = new Date();
    }
    GuiElement.raiseIfHasTagname(selector);
    super("datetime-local", `input${selector}`);
    this.date = date;
  }

  get date() {
    return new Date(this.value);
  }

  set date(date) {
    this.value = date.toISOString().slice(0, 16);
  }
}

// Components and small widgets

/**
 * Represents a titlebar element for a GUI application.
 *
 * Provides a customizable title and a close button.
 */
class TitleBar extends GuiElement {
  #label;
  #button;

  /**
   * Constructs a new Titlebar element.
   *
   * @param {string} title (Optional) The initial title text for the titlebar.
   */
  constructor(title = "") {
    super("div h5 button");

    this.#label = this.querySelector("h5");
    this.#button = this.querySelector("button");

    this.title = title;
  }

  /**
   * Returns the close button element.
   * @returns {Element} The close button element.
   */
  get button() {
    return this.#button;
  }

  /**
   * Returns the title text container for the titlebar.
   * @returns {Element} The title text container.
   */
  get label() {
    return this.#label;
  }

  /**
   * Sets the title text for the titlebar.
   *
   * @param {string} title The new title text.
   */
  set title(title) {
    this.#label.text = title;
  }
}

class ContentPanel {
  #bar;

  /**
   * Constructs a new ContentPanel element.
   */
  constructor(content) {
    this.#bar = content.querySelector("hr");
  }

  addContent(content) {
    this.#bar.before(content);
  }

  clearContent() {
    this.#bar.before();
  }

  setContent(content) {
    this.clearContent();
    this.addContent(content);
  }
}

/**
 * Represents a statusbar element for a GUI application.
 */
class StatusPanel {
  #bar;

  /**
   * Constructs a new Statusbar element.
   */
  constructor(content) {
    this.#bar = content.querySelector("hr");
  }

  addStatus(text = "", selector = "", role = "") {
    const status = new GuiElement(selector, role);
    status.html = markdownToHtml(text);
    this.#bar.after(status.element);
  }

  clearStatus() {
    this.#bar.after();
  }

  setStatus(text = "", selector = "", role = "") {
    this.clearStatus();
    this.addStatus(text, selector, role);
  }

  set status(text) {
    this.setStatus(text);
  }
}

class BodySection extends GuiElement {
  #content;
  #status;

  constructor() {
    super("div hr");
    this.#content = new ContentPanel(this);
    this.#status = new StatusPanel(this);
  }

  get content() {
    return this.#content;
  }

  get status() {
    return this.#status;
  }
}

class ControlBar extends GuiElement {
  #buttonPrimary;
  #buttonSecondary;

  constructor(labels = ["Accept", "Cancel"]) {
    super("div button button");

    this.#buttonSecondary = this.querySelector("button");
    this.#buttonPrimary = this.querySelector("button:last-child");

    this.setLabel(labels);
  }

  setLabel(labels) {
    labels = Array.isArray(labels) ? labels : [labels, ""];
    if (labels[0]) {
      this.#buttonPrimary.text = labels[0];
    } else {
      this.#buttonPrimary.hide();
      this.#buttonPrimary.text = "";
    }
    if (labels[1]) {
      this.#buttonSecondary.text = labels[1];
    } else {
      this.#buttonSecondary.hide();
      this.#buttonSecondary.text = "";
    }
  }

  get primary() {
    return this.#buttonPrimary;
  }

  get secondary() {
    return this.#buttonSecondary;
  }
}

// Windows, dialogs and complex widgets

class BaseWindow extends GuiElement {
  #body;
  #container;
  #controlBar;
  #titleBar;

  constructor(source, body, titleBar, controlBar) {
    super(`${source} div`);

    body = body ?? new BodySection();
    titleBar = titleBar ?? new TitleBar();
    controlBar = controlBar ?? new ControlBar();

    this.#container = this.querySelector("div");
    this.#container.append([titleBar, body, controlBar]);

    this.#body = body;
    this.#titleBar = titleBar;
    this.#controlBar = controlBar;
  }

  get body() {
    return this.#body;
  }

  get container() {
    return this.#container;
  }

  get content() {
    return this.#body.content;
  }

  get controlBar() {
    return this.#controlBar;
  }

  get status() {
    return this.#body.status;
  }

  get titleBar() {
    return this.#titleBar;
  }
}

class DialogWindow extends BaseWindow {
  constructor(selector, size = [400, 300]) {
    [selector, size] = DialogWindow.#getParams(selector, size);
    super(selector);

    this.size = size;
  }

  static #getParams(selector, size) {
    if (typeof selector !== "string" && !Array.isArray(selector)) {
      throw new TypeError("First argument must be a string or an array");
    }
    if (!Array.isArray(size)) {
      throw new TypeError("Second argument must be an array");
    }
    if (Array.isArray(selector)) {
      // If first argument`, `selector`, is an array assume it is `size`
      [size, selector] = [selector, ""];
    }
    if (
      size.length !== 2 ||
      !size.every((item) => {
        return typeof item === "number" || typeof item === "string";
      })
    ) {
      throw new TypeError(
        "Second argument must be an array of 2 numbers or strings",
      );
    }
    return [selector, size];
  }
}

class ModalDialog {
  #curtain;
  #dialog;

  constructor(selector) {
    this.#curtain = new GuiElement(selector);
    this.#dialog = new DialogWindow();
    this.#curtain.append(this.dialog);
  }

  get body() {
    return this.#dialog.body;
  }

  get container() {
    return this.#dialog.container;
  }

  get content() {
    return this.#dialog.content;
  }

  get controlBar() {
    return this.#dialog.controlBar;
  }

  get curtain() {
    return this.#curtain;
  }

  get dialog() {
    return this.#dialog;
  }

  get status() {
    return this.#dialog.status;
  }

  get titleBar() {
    return this.#dialog.titleBar;
  }
}

// Auxiliary widgets

class ButtonGroup extends GuiElement {
  constructor(selector = "") {
    super(`div${selector}`);
    this.element.role = "group";
  }

  addButton(text = "", selector = "") {
    return this.#createButton(Button, text, selector);
  }

  addLinkButton(text = "", selector = "") {
    return this.#createButton(LinkButton, text, selector);
  }

  append(button) {
    const buttons = Array.isArray(button) ? button : [button];
    for (const button of buttons) {
      this.#appendButton(button);
    }
  }

  #appendButton(button) {
    if (button instanceof BaseButton) {
      super.append(button);
    } else {
      throw new TypeError("ButtonGroup can only contain BaseButton instances");
    }
  }

  #createButton(type, text, selector) {
    const button = new type(text, selector);
    this.append(button);
    return button;
  }
}

export {
  Button,
  ButtonGroup,
  Datepicker,
  DialogWindow,
  GuiElement,
  LinkButton,
  ModalDialog,
};
