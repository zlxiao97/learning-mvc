/*global jQuery, Handlebars, Router */
jQuery(function ($) {
  "use strict";

  Handlebars.registerHelper("eq", function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;
  const TAG_TYPES = ["success", "info", "warning", "danger"];

  var util = {
    uuid: function () {
      /*jshint bitwise:false */
      var i, random;
      var uuid = "";

      for (i = 0; i < 32; i++) {
        random = (Math.random() * 16) | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += "-";
        }
        uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(
          16
        );
      }

      return uuid;
    },
    pluralize: function (count, word) {
      return count === 1 ? word : word + "s";
    },
    unique: function (arr) {
      return Array.from(new Set(arr));
    },
    /** Model */
    store: function (namespace, data) {
      if (arguments.length > 1) {
        return localStorage.setItem(namespace, JSON.stringify(data));
      } else {
        var store = localStorage.getItem(namespace);
        return (store && JSON.parse(store)) || [];
      }
    }
  };

  /** Controller */
  var App = {
    init: function () {
      this.todos = util.store("todos-jquery");
      this.todoTemplate = Handlebars.compile($("#todo-template").html());
      this.footerTemplate = Handlebars.compile($("#footer-template").html());
      this.bindEvents();

      new Router({
        "/:filter": function (filter) {
          this.filter = filter;
          this.render();
        }.bind(this)
      }).init("/all");
    },
    bindEvents: function () {
      $(".new-todo").on("keyup", this.create.bind(this));
      $(".toggle-all").on("change", this.toggleAll.bind(this));
      $(".footer")
        .on("click", ".clear-completed", this.destroyCompleted.bind(this))
        .on("change", ".tag-select", this.changeTagFilter.bind(this));
      $(".todo-list")
        .on("change", ".toggle", this.toggle.bind(this))
        .on("dblclick", "label", this.editingMode.bind(this))
        .on("keyup", ".edit", this.editKeyup.bind(this))
        .on("focusout", ".edit", this.update.bind(this))
        .on("click", ".destroy", this.destroy.bind(this))
        .on("click", ".add-tag", this.addTag.bind(this));
    },
    render: function () {
      var filteredTodos = this.getFilteredTodos();
      var todos = this.getSortedTodos(filteredTodos);
      $(".todo-list").html(this.todoTemplate(todos));
      $(".main").toggle(todos.length > 0);
      $(".toggle-all").prop("checked", this.getActiveTodos().length === 0);
      this.renderFooter();
      $(".new-todo").focus();
      util.store("todos-jquery", this.todos);
    },
    renderFooter: function () {
      var todoCount = this.todos.length;
      var activeTodoCount = this.getActiveTodos().length;
      const tagTypes = this.todos
      .map((item) => item.tag)
      .filter((item) => !!item)
      const tagOptions = util.unique(tagTypes);
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, "item"),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter,
        tagOptions,
        tagFilter: this.tagFilter,
      });

      $(".footer")
        .toggle(todoCount > 0)
        .html(template);
    },
    toggleAll: function (e) {
      var isChecked = $(e.target).prop("checked");

      this.todos.forEach(function (todo) {
        todo.completed = isChecked;
      });

      this.render();
    },
    getActiveTodos: function () {
      return this.todos.filter(function (todo) {
        return !todo.completed;
      });
    },
    getCompletedTodos: function () {
      return this.todos.filter(function (todo) {
        return todo.completed;
      });
    },
    getFilteredTodos: function () {
      const that = this;
      let result = this.todos;
      if (this.filter === "active") {
        result = this.getActiveTodos();
      }

      if (this.filter === "completed") {
        result = this.getCompletedTodos();
      }

      return result.filter(function (todo) {
        return that.tagFilter ? todo.tag === that.tagFilter : true;
      });
    },
    getSortedTodos: function (todos) {
      return todos.sort(function ({ title: titleA }, { title: titleB }) {
        if (titleA < titleB) {
          return -1;
        } else if (titleA > titleB) {
          return 1;
        } else {
          return 0;
        }
      });
    },
    destroyCompleted: function () {
      this.todos = this.getActiveTodos();
      this.render();
    },
    // accepts an element from inside the `.item` div and
    // returns the corresponding index in the `todos` array
    getIndexFromEl: function (el) {
      var id = $(el).closest("li").data("id");
      var todos = this.todos;
      var i = todos.length;

      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    },
    create: function (e) {
      var $input = $(e.target);
      var val = $input.val().trim();

      if (e.which !== ENTER_KEY || !val) {
        return;
      }

      this.todos.push({
        id: util.uuid(),
        title: val,
        completed: false,
        tag: false,
        tagType:''
      });

      $input.val("");

      this.render();
    },
    toggle: function (e) {
      var i = this.getIndexFromEl(e.target);
      this.todos[i].completed = !this.todos[i].completed;
      this.render();
    },
    editingMode: function (e) {
      var $input = $(e.target).closest("li").addClass("editing").find(".edit");
      // puts caret at end of input
      var tmpStr = $input.val();
      $input.val("");
      $input.val(tmpStr);
      $input.focus();
    },
    editKeyup: function (e) {
      if (e.which === ENTER_KEY) {
        e.target.blur();
      }

      if (e.which === ESCAPE_KEY) {
        $(e.target).data("abort", true).blur();
      }
    },
    update: function (e) {
      var el = e.target;
      var $el = $(el);
      var val = $el.val().trim();

      if ($el.data("abort")) {
        $el.data("abort", false);
      } else if (!val) {
        this.destroy(e);
        return;
      } else {
        this.todos[this.getIndexFromEl(el)].title = val;
      }

      this.render();
    },
    destroy: function (e) {
      this.todos.splice(this.getIndexFromEl(e.target), 1);
      this.render();
    },
    addTag: function (e) {
      const el = e.target
      const $el = $(e.target);
      const id = $el.data("id");
      const todo = this.todos.find((todo) => todo.id === id);
      const inputTag = prompt(`???????????????${todo.title}??????tag`)
      const tagType = TAG_TYPES[Math.floor(Math.random() * TAG_TYPES.length)];
      this.todos[this.getIndexFromEl(el)].tag = inputTag
      this.todos[this.getIndexFromEl(el)].tagType = tagType
      this.render();
    },
    changeTagFilter: function (e) {
      const payload = e.target.value
      this.tagFilter = payload;
      this.render();
    }
  };

  App.init();
});
