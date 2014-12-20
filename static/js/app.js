var editor;
var connected = false;
var $tree = $('#database-tree');
var theTable = '';
var theDatabase = '';
var dbChildNode = [
  {
    label: 'Table',
    load_on_demand: true,
    type: 'tbl-holder'
  },
  {
    label: 'Procedure',
    load_on_demand: true,
    type: 'sp-holder'
  },
  {
    label: 'Function',
    load_on_demand: true,
    type: 'fn-holder'
  }
];

function apiCall(method, path, params, cb) {
  $.ajax({
    url: path,
    method: method,
    cache: false,
    data: params,
    success: function(data) {
      cb(data);
    },
    error: function(xhr, status, data) {
      cb(jQuery.parseJSON(xhr.responseText));
    }
  });
}

function getTables(cb)                        { apiCall("get", "/tables", {}, cb); }
function getTableStructure(table, cb)         { apiCall("get", "/tables/" + table, {}, cb); }
function getTablesOfDatabase(dbName, cb)      { apiCall("get", "/databases/" + dbName + "/tables", {}, cb); }
function getProceduresOfDatabase(dbName, cb)  { apiCall("get", "/databases/" + dbName + "/procedures", {}, cb); }
function getTableIndexes(table, cb)           { apiCall("get", "/tables/" + table + "/indexes", {}, cb); }
function getHistory(cb)                       { apiCall("get", "/history", {}, cb); }
function getDatabases(cb)                     { apiCall("get", "/databases", {}, cb); }
function setDefaultDatabase(dbName, cb)       { apiCall("post", "/databases/" + dbName + "/actions/default", {}, cb); }

var fnGetSelectedTable = function(){
  return theTable;
}

var fnShowTheDatabase = function(){
  //Remove previous one
  $('.selected-db').removeClass('selected-db');

  //Get all nodes with name as database name

  var arrFirst = $tree.tree('getNodesByProperty', 'name', theDatabase);

  //If we got no nodes, than it's sad
  if(arrFirst.length === 0){
    return;
  }

  //Chances are we might get nodes of type table as well as database
  //Let's apply filter again, this time for type database
  //Just in case
  var myNode = arrFirst.filter(function (el) {
    return el.type == 'database';
  });

  if(myNode.length === 0){
    return;
  }

  //Apply style to this node
  //Make it bold
  var $nodeEle = $(myNode[0].element);
  $nodeEle.addClass('selected-db');
}

function forTheTree(){
  $('#database-tree').bind('tree.toggle',function(e) {
    var dbNode = e.node;
    var dbName = dbNode.parent.name;

    //If data is already loaded, just do nothing.
    //It's all taken care of.
    if(dbNode.data_loaded){
      return;
    }

    if (dbNode.type === 'tbl-holder') {
      getTablesOfDatabase(dbName, function(data){
        var objData = [];

        data.forEach(function(val){
          objData.push({
            label: val,
            type: 'table'
          });
        });

        $tree.tree('loadData', objData, dbNode);
        $tree.tree('updateNode', dbNode, { data_loaded: true, });
        $tree.tree('openNode', dbNode);
      });
    }
    else if (dbNode.type === 'sp-holder') {
      getProceduresOfDatabase(dbName, function(data){
        var objData = [];

        data.forEach(function(val){
          objData.push({
            label: val,
            type: 'procedure'
          });
        });

        $tree.tree('loadData', objData, dbNode);
        $tree.tree('updateNode', dbNode, { data_loaded: true, });
        $tree.tree('openNode', dbNode);
      });
    }
  });

  $('#database-tree').bind('tree.click',function(e) {
    var dbNode = e.node;
    var nodeName = dbNode.name;

    if(dbNode.type === 'table'){
      theTable = nodeName;
      $('li.jqtree_common.active').removeClass('active');
      $(dbNode.element).addClass('active');
    }

    e.preventDefault();
  });

  //Double click on a database node, to set it as default
  //tree.dblclick
  $tree.on('tree.dblclick', function(e){
    e.preventDefault();

    var dbNode = e.node;

    if(dbNode.type === 'database'){
      theDatabase = dbNode.name;

      //Set this as default database
      setDefaultDatabase(dbNode.name, function(){
        //Highglight this database node
        fnShowTheDatabase();
      });


    }

  });

  //Listen when data is refreshed inside the tree
  $tree.on('tree.refresh', function(e){
    fnShowTheDatabase();
  });
  $tree.on('tree.open', function(e){
    fnShowTheDatabase();
  });
}

function executeQuery(query, cb) {
  apiCall("post", "/query", { query: query }, cb);
}

function explainQuery(query, cb) {
  apiCall("post", "/explain", { query: query }, cb);
}

function loadTables() {
  $("#tables li").remove();

  getTables(function(data) {
    data.forEach(function(item) {
      $('<li data-jstree="{"children":true}"><span>' + item + '</span></li>').appendTo("#tables");
    });
  });
}

function loadDatabases() {
  $('#database-tree').empty();

  getDatabases(function(data){
    //generateFromTemplate({database: data}, 'tmpl-database-tree', $('#database-tree'), true);
    var objData = [];

    data.forEach(function(val){
      objData.push({
        label: val,
        type: 'database',
        children: dbChildNode
      });
    });
    //Make a jsTree
    $('#database-tree').tree({data: objData});

    forTheTree();

    //Highlisht the selected database, if any
    fnShowTheDatabase();
  });
}

function escapeHtml(str) {
  if (str != null || str != undefined) {
    return jQuery("<div/>").text(str).html();
  }

  return "<span class='null'>null</span>";
}

function unescapeHtml(str){
  var e = document.createElement("div");
  e.innerHTML = str;
  return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

function resetTable() {
  $("#results").
    attr("data-mode", "").
    text("").
    removeClass("empty").
    removeClass("no-crop");
}

function buildTable(results) {
  resetTable();

  if (results.error) {
    $("<tr><td>ERROR: " + results.error + "</tr></tr>").appendTo("#results");
    $("#results").addClass("empty");
    return;
  }

  if (!results.rows) {
    $("<tr><td>No records found</tr></tr>").appendTo("#results");
    $("#results").addClass("empty");
    return;
  }

  var cols = "";
  var rows = "";

  results.columns.forEach(function(col) {
    cols += "<th data='" + col + "'>" + col + "</th>";
  });

  results.rows.forEach(function(row) {
    var r = "";
    for (i in row) { r += "<td><div>" + escapeHtml(row[i]) + "</div></td>"; }
    rows += "<tr>" + r + "</tr>";
  });

  $("<thead>" + cols + "</thead><tbody>" + rows + "</tobdy>").appendTo("#results");
}

function setCurrentTab(id) {
  $("#nav ul li.selected").removeClass("selected");
  $("#" + id).addClass("selected");
}

function showQueryHistory() {
  getHistory(function(data) {
    var rows = [];

    for(i in data) {
      rows.unshift([parseInt(i) + 1, data[i]]);
    }

    buildTable({ columns: ["id", "query"], rows: rows });

    setCurrentTab("table_history");
    $("#input").hide();
    $("#output").addClass("full");
    $("#results").addClass("no-crop");
  });
}

function showTableIndexes() {
  var name = fnGetSelectedTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  getTableIndexes(name, function(data) {
    setCurrentTab("table_indexes");
    buildTable(data);

    $("#input").hide();
    $("#output").addClass("full");
    $("#results").addClass("no-crop");
  });
}

function showTableInfo() {
  var name = fnGetSelectedTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  apiCall("get", "/tables/" + name + "/info", {}, function(data) {
    $(".table-information ul").show();
    $("#table_total_size").text(data.total_size);
    $("#table_data_size").text(data.data_size);
    $("#table_index_size").text(data.index_size);
    $("#table_rows_count").text(data.rows_count);
    $("#table_encoding").text("Unknown");
  });
}

function showTableContent() {
  var name = fnGetSelectedTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  var query = "SELECT * FROM " + name + " LIMIT 100;";

  executeQuery(query, function(data) {
    buildTable(data);
    setCurrentTab("table_content");

    $("#results").attr("data-mode", "browse");
    $("#input").hide();
    $("#output").addClass("full");
  });
}

function showTableStructure() {
  var name = fnGetSelectedTable();

  if (name.length == 0) {
    alert("Please select a table!");
    return;
  }

  getTableStructure(name, function(data) {
    setCurrentTab("table_structure");
    buildTable(data);
  });
}

function showQueryPanel() {
  setCurrentTab("table_query");
  editor.focus();

  $("#input").show();
  $("#output").removeClass("full");
}

function showConnectionPanel() {
  setCurrentTab("table_connection");

  apiCall("get", "/info", {}, function(data) {
    var rows = [];

    for(key in data) {
      rows.push([key, data[key]]);
    }

    buildTable({
      columns: ["attribute", "value"],
      rows: rows
    });

    $("#input").hide();
    $("#output").addClass("full");
  });
}

function runQuery() {
  setCurrentTab("table_query");

  $("#run, #explain, #csv").prop("disabled", true);
  $("#query_progress").show();

  var query = $.trim(editor.getValue());

  if (query.length == 0) {
    $("#run, #explain, #csv").prop("disabled", false);
    $("#query_progress").hide();
    return;
  }

  executeQuery(query, function(data) {
    buildTable(data);

    $("#run, #explain, #csv").prop("disabled", false);
    $("#query_progress").hide();
    $("#input").show();
    $("#output").removeClass("full");

    if (query.toLowerCase().indexOf("explain") != -1) {
      $("#results").addClass("no-crop");
    }
  });
}

function runExplain() {
  setCurrentTab("table_query");

  $("#run, #explain, #csv").prop("disabled", true);
  $("#query_progress").show();

  var query = $.trim(editor.getValue());

  if (query.length == 0) {
    $("#run, #explain, #csv").prop("disabled", false);
    $("#query_progress").hide();
    return;
  }

  explainQuery(query, function(data) {
    buildTable(data);

    $("#run, #explain, #csv").prop("disabled", false);
    $("#query_progress").hide();
    $("#input").show();
    $("#output").removeClass("full");
    $("#results").addClass("no-crop");
  });
}

function exportToCSV() {
  var query = $.trim(editor.getValue());

  if (query.length == 0) {
    return;
  }

  // Replace line breaks with spaces and properly encode query
  query = window.encodeURI(query.replace(/\n/g, " "));

  var url = "http://" + window.location.host + "/query?format=csv&query=" + query;
  var win = window.open(url, '_blank');

  setCurrentTab("table_query");
  win.focus();
}

function initEditor() {
  editor = ace.edit("custom_query");

  editor.getSession().setMode("ace/mode/pgsql");
  editor.getSession().setTabSize(2);
  editor.getSession().setUseSoftTabs(true);
  editor.commands.addCommands([{
    name: "run_query",
    bindKey: {
      win: "Ctrl-Enter",
      mac: "Command-Enter"
    },
    exec: function(editor) {
      runQuery();
    }
  }, {
    name: "explain_query",
    bindKey: {
      win: "Ctrl-E",
      mac: "Command-E"
    },
    exec: function(editor) {
      runExplain();
    }
  }]);
}

function addShortcutTooltips() {
  if (navigator.userAgent.indexOf("OS X") > 0) {
    $("#run").attr("title", "Shortcut: ⌘+Enter");
    $("#explain").attr("title", "Shortcut: ⌘+E");
  }
  else {
    $("#run").attr("title", "Shortcut: Ctrl+Enter");
    $("#explain").attr("title", "Shortcut: Ctrl+E");
  }
}

function showConnectionSettings() {
  $("#connection_window").show();
}

function getConnectionString() {
  var url  = $.trim($("#connection_url").val());
  var mode = $(".connection-group-switch button.active").attr("data");
  var ssl  = $("#connection_ssl").val();

  if (mode == "standard") {
    var host = $("#pg_host").val();
    var port = $("#pg_port").val();
    var user = $("#pg_user").val();
    var pass = $("#pg_password").val();
    var db   = $("#pg_db").val();

    if (port.length == 0) {
      port = "3306";
    }
    if(db.length > 0){
      theDatabase = db;
    }

    url = user + ":" + pass + "@tcp(" + host + ":" + port + ")/" + db;
  }
  else {
    if (url.indexOf("localhost") != -1 && url.indexOf("sslmode") == -1) {
      //url += "?sslmode=" + ssl;
    }
  }

  return url;
}

function generateFromTemplate(objData, templateId, $destContainer, iReplace){
  var source   = $("#"+templateId).html();
  var template = Handlebars.compile(source);
  var html    = template(objData);

  if(iReplace){
    $destContainer.html(html);
  }
  else{
    $destContainer.append(html);
  }
}

$(document).ready(function() {
  $("#table_content").on("click",    function() { showTableContent();    });
  $("#table_structure").on("click",  function() { showTableStructure();  });
  $("#table_indexes").on("click",    function() { showTableIndexes();    });
  $("#table_history").on("click",    function() { showQueryHistory();    });
  $("#table_query").on("click",      function() { showQueryPanel();      });
  $("#table_connection").on("click", function() { showConnectionPanel(); });

  $("#run").on("click", function() {
    runQuery();
  });

  $("#explain").on("click", function() {
    runExplain();
  });

  $("#csv").on("click", function() {
    exportToCSV();
  });

  $("#results").on("click", "tr", function() {
    $("#results tr.selected").removeClass();
    $(this).addClass("selected");
  });

  $("#results").on("dblclick", "td > div", function() {
    if ($(this).has("textarea").length > 0) {
      return;
    }

    var value = unescapeHtml($(this).html());
    if (!value) { return; }

    var textarea = $("<textarea />").
      text(value).
      addClass("form-control").
      css("width", $(this).css("width"));

    if (value.split("\n").length >= 3) {
      textarea.css("height", "200px");
    }

    $(this).html(textarea).css("max-height", "200px");
  });

  $("#tables").on("click", "li", function() {
    $("#tables li.selected").removeClass("selected");
    $(this).addClass("selected");
    showTableContent();
    showTableInfo();
  });

  $("#edit_connection").on("click", function() {
    if (connected) {
      $("#close_connection_window").show();
    }

    showConnectionSettings();
  });

  $("#close_connection_window").on("click", function() {
    $("#connection_window").hide();
  });

  $("#connection_url").on("change", function() {
    if ($(this).val().indexOf("localhost") != -1) {
      $("#connection_ssl").val("disable");
    }
  });

  $("#pg_host").on("change", function() {
    if ($(this).val().indexOf("localhost") != -1) {
      $("#connection_ssl").val("disable");
    }
  });

  $(".connection-group-switch button").on("click", function() {
    $(".connection-group-switch button").removeClass("active");
    $(this).addClass("active");

    switch($(this).attr("data")) {
      case "scheme":
        $(".connection-scheme-group").show();
        $(".connection-standard-group").hide();
        return;
      case "standard":
        $(".connection-scheme-group").hide();
        $(".connection-standard-group").show();
        $(".connection-ssh-group").hide();
        return;
      case "ssh":
        $(".connection-scheme-group").hide();
        $(".connection-standard-group").show();
        $(".connection-ssh-group").show();
        return;
    }
  });

  $("#connection_form").on("submit", function(e) {
    e.preventDefault();

    var button = $(this).children("button");
    var url = getConnectionString();

    if (url.length == 0) {
      return;
    }

    $("#connection_error").hide();
    button.prop("disabled", true).text("Please wait...");

    apiCall("post", "/connect", { url: url }, function(resp) {
      button.prop("disabled", false).text("Connect");

      if (resp.error) {
        connected = false;
        $("#connection_error").text(resp.error).show();
      }
      else {
        connected = true;
        $("#connection_window").hide();
        //loadTables();
        loadDatabases();
        $("#main").show();
      }
    });
  });

  initEditor();
  addShortcutTooltips();

  apiCall("get", "/info", {}, function(resp) {
    if (resp.error) {
      connected = false;
      showConnectionSettings();
    }
    else {
      connected = true;
      //loadTables();
      theDatabase = resp['DATABASE()'];
      loadDatabases();
      $("#main").show();
    }
  });
});
