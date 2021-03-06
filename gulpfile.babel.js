//https://medium.com/@andrewhenderson/es6-with-babel-6-gulp-and-rollup-aa7aeddeccc6
//https://github.com/gulpjs/gulp#use-latest-javascript-version-in-your-gulpfile
//
//  npm i -D  babel-core  gulp@next gulp-file gulp-sass  rollup rollup-plugin-node-resolve rollup-plugin-babel babel-preset-env babel-plugin-external-helpers
//
//For cleanup/minification:
//  npm i -D  gulp-strip-comments gulp-header gulp-uglify gulp-rename
//
//(Ignore warning "Failed to load external module @babel/register")
//https://github.com/gulpjs/gulp/issues/1631


import gulp from 'gulp';
import file from 'gulp-file';
import sass from 'node-sass';
import pug  from 'pug';
import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';
//If the code imports modules from /node_modules
import resolve from 'rollup-plugin-node-resolve';

//Cleanup & minification step:
import replace from 'gulp-replace';
import strip  from 'gulp-strip-comments';
import header from 'gulp-header';
import rename from 'gulp-rename';
import uglify from 'gulp-uglify';

import * as pkg from './package.json';

//Automatically build/reload on file changes:
import { spawn } from 'child_process';


const globalName = 'Picker',
      outFolder = 'dist/',
      //Remove scope (if any) from output path:
      outFile = pkg.name.replace(/.*\//, '');

const myBanner = `/*!
 * <%= pkg.name %> v<%= pkg.version %>
 * <%= pkg.homepage %>
 *
 * Copyright 2017-<%= new Date().getFullYear() %> <%= pkg.author %>
 * Released under the <%= pkg.license %> license.
 */
`;


gulp.task('build', function() {
    return rollup({
        input: pkg.module,
        plugins: [
            resolve({
                module: true,
            }),
            babel({
                babelrc: false,
                presets: [
                  ["env", { modules: false }]
                ],
                //We import ES6 modules (color-conversion and drag-tracker)..
                //  exclude: 'node_modules/**',

                plugins: ["external-helpers"],
            }),
        ],
    })
    .then(bundle => {
        return bundle.generate({
          format: 'umd',
          name: globalName,
        });
    })
    .then(gen => {
        
        //  //Before we create the destination file, prepare the CSS which we'll paste into the JS code:
        //  //https://github.com/dlmanning/gulp-sass#basic-usage
        //  gulp.src(pkg.module.replace('.js', '.scss'))
        //      .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        //  
        //      //https://stackoverflow.com/questions/41523743/can-i-convert-a-gulp-stream-into-a-string
        //      .on('data', function(cssStream) {
        //          const css = cssStream.contents.toString();
        //          //console.log(css);

        //Easier to use the normal node packages to read the HTML and CSS we'll inline into the JS:
        const sassed = sass.renderSync({
            file: pkg.module.replace('.js', '.scss'),
            outputStyle: 'compressed',
        });
        const css = sassed.css.toString(); //(Buffer.toString())
        //console.log('CSS:', css);
        
        const html = pug.renderFile(pkg.module.replace('.js', '.pug'));
        //console.log('HTML:', html);

        file(outFile + '.js', gen.code, { src: true })
            .pipe(strip())
            .pipe(replace( '## PLACEHOLDER-CSS ##', css.replace(/'/g, "\\'").trim() ))
            .pipe(replace( '## PLACEHOLDER-HTML ##', html ))

            //Write un-minified:
            .pipe(header(myBanner, { pkg : pkg }))
            .pipe(gulp.dest(outFolder))

            //Minify:
            //https://codehangar.io/concatenate-and-minify-javascript-with-gulp/
            //https://stackoverflow.com/questions/32656647/gulp-bundle-then-minify
            //(https://stackoverflow.com/questions/40609393/gulp-rename-illegal-operation)
            .pipe(rename({ extname: '.min.js' }))
            .pipe(uglify())

            .pipe(header(myBanner, { pkg: pkg }))
            .pipe(gulp.dest(outFolder));

        //      });
    });
});


/* The rest of these tasks are only here to run 'build' automatically when files change */


//https://github.com/gulpjs/gulp/blob/master/docs/API.md#gulpwatchglobs-opts-fn
//https://css-tricks.com/gulp-for-beginners/
gulp.task('watch', function() {
    console.log('** Listening for file changes...');

    //Rebuild when anything in src/ changes:
    //https://stackoverflow.com/questions/27645103/how-to-gulp-watch-multiple-files
    const watcher = gulp.watch(['src/**/*.*'], gulp.parallel('build'));
    
    watcher.on('change', function(path, stats) {
      console.log('File ' + path + ' was changed');
    });
    watcher.on('unlink', function(path) {
      console.log('File ' + path + ' was removed');
    });
});


gulp.task('startup', gulp.series('build', 'watch'));


//In addition to listening for code changes, we also need to restart gulp whenever package.json or gulpfile.babel.js change
//https://stackoverflow.com/questions/22886682/how-can-gulp-be-restarted-upon-each-gulpfile-change
//https://gist.github.com/tilap/31167027ddee8acbf0e7
gulp.task('auto-reload', function() {
    let p;
    
    gulp.watch(['*.js*'], spawnChildren);
    spawnChildren();
    
    function spawnChildren(callback) {
        //Kill previous spawned process
        if(p) { p.kill(); }
        
        //`spawn` a child `gulp` process linked to the parent `stdio`
        p = spawn('gulp', ['startup'], { stdio: 'inherit' });

        //https://github.com/gulpjs/gulp/blob/master/docs/API.md#fn-1
        if(callback) {
            console.log('package.json or gulpfile.babel.js changed, restarted..');
            callback();
        }
    }
});


gulp.task('default', gulp.series('auto-reload'));
