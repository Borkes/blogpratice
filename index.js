'use strict';

var path = require('path');
var express = require('express');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var flash = require('connect-flash');
var config = require('config-lite');
var routes = require('./routes');
var pkg = require('./package');
var log4js = require('log4js');
var fs = require('fs')

var app = express();

// 设置模板目录
app.set('views', path.join(__dirname, 'views'));
// 设置模板引擎为 ejs
app.set('view engine', 'ejs');

app.set('routes', path.join(__dirname, 'routes/'));

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));
app.use(log4js.connectLogger(log4js.getLogger('main'), { level: 'AUTO', format: ':remote-addr :method :url :status :response-time ms' }))
// session 中间件
app.use(session({
    name: config.session.key, // 设置 cookie 中保存 session id 的字段名称
    secret: config.session.secret, // 通过设置 secret 来计算 hash 值并放在 cookie 中，使产生的 signedCookie 防篡改
    resave: true, // 强制更新 session
    saveUninitialized: false, // 设置为 false，强制创建一个 session，即使用户未登录
    cookie: {
        maxAge: config.session.maxAge// 过期时间，过期后 cookie 中的 session id 自动删除
    },
    store: new MongoStore({// 将 session 存储到 mongodb
        url: config.mongodb// mongodb 地址
    })
}));
// flash 中间件，用来显示通知
app.use(flash());

// 处理表单及文件上传的中间件
app.use(require('express-formidable')({
    uploadDir: path.join(__dirname, 'public/img'),// 上传文件目录
    keepExtensions: true// 保留后缀
}));

// 设置模板全局常量
app.locals.blog = {
    title: pkg.name,
    description: pkg.description
};

// 添加模板必需的三个变量
app.use(function (req, res, next) {
    res.locals.user = req.session.user;
    res.locals.success = req.flash('success').toString();
    res.locals.error = req.flash('error').toString();
    next();
});


// 自动路由
var routers = app.get('routes');
fs.readdirSync(routers).forEach(function (fileName) {
    var filePath = routers + fileName;
    var rname = fileName.substr(0, fileName.lastIndexOf("."));
    if (!fs.lstatSync(filePath).isDirectory()) {
        if (rname === 'index') {
            app.use('/', require(filePath));
        }
        app.use('/' + rname, require(filePath));
    } else {
        var dirName = fileName;
        fs.readdirSync(routes + dirName).forEach(function (childFileName) {
            var childFilePath = filePath + '/' + childFileName;
            var childName = childFileName.substr(0, childFileName.lastIndexOf('.'));
            if (!fs.lstatSync(childFilePath).isDirectory()) {
                if (childName === 'index') {
                    app.use('/' + dirName, require(childFilePath));
                }
                app.use('/' + dirName + '/' + childName, require(childFilePath));
            }
        })
    }
})

app.use(function (req, res) {
    if (!res.headersSent) {
        res.status(404).render('404');
    }
});

// error page
app.use(function (err, req, res, next) {
    res.render('error', {
        error: err
    });
});


// 直接启动 index.js 则会监听端口启动程序，如果 index.js 被 require 了，则导出 app，通常用于测试
if (module.parent) {
    module.exports = app;
} else {
    // 监听端口，启动程序
    app.listen(config.port, function () {
        console.log(`${pkg.name} listening on port ${config.port}`);
    });
}
