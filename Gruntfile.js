'use strict';

module.exports = function (grunt) {

    grunt.initConfig({

        mixtube: {
            app: 'app',
            dist: 'dist'

        },

        clean: {
            dist: {
                files: [
                    {
                        dot: true,
                        src: [ '.tmp', '<%= mixtube.dist %>/*']
                    }
                ]
            },
            server: '.tmp'
        },

        // compiles sass files to css but excludes external libs
        sass: [
            {
                expand: true,
                cwd: 'app',
                src: [ '**/*.scss', '!**/vendor/**'],
                dest: '.tmp',
                ext: '.css'
            }
        ],

        watch: {

            // watches sass files to compile them a soon as they are modified by running the sass task
            sass: {
                files: ['<%= mixtube.app %>/**/*.scss'],
                tasks: ['sass']
            },

            // reload the css in the browser when changed
            livereload: {
                files: ['.tmp/**/*.css'],
                options: {
                    livereload: true
                }
            }
        },

        // the web server for dev purposes
        connect: {
            server: {
                options: {
                    hostname: '*',
                    port: 8080,
                    base: ['.tmp', '<%= mixtube.app %>']
                }
            }
        },

        // prepares the the conf for concat
        useminPrepare: {
            options: {
                dest: '<%= mixtube.dist %>',
                flow: {
                    steps: {'js': ['concat'], css: ['concat']},
                    post: {}
                }
            },
            html: '<%= mixtube.app %>/*.html'
        },

        // copies all the files that don't need any special processing
        copy: [
            {expand: true, cwd: '<%= mixtube.app %>', dest: '<%= mixtube.dist %>', src: ['*.html']},
            {expand: true, flatten: true, cwd: '<%= mixtube.app %>', dest: '<%= mixtube.dist %>/styles', src: ['**/*.{eot,svg,ttf,woff}']}
        ],

        // prepends files name with a hash of the content, we need to process the css dependencies first and then treat
        // the html dependencies
        rev: {
            css: {
                files: {
                    src: ['<%= mixtube.dist %>/styles/*.{eot,svg,ttf,woff}']
                }
            },
            html: {
                files: {
                    src: ['<%= mixtube.dist %>/scripts/*.js', '<%= mixtube.dist %>/styles/*.css']
                }
            }
        },

        // replaces path in index.html by the concatenated versions
        usemin: {
            css: ['<%= mixtube.dist %>/styles/*.css'],
            html: ['<%= mixtube.dist %>/*.html']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-rev');

    // a dev oriented task that watches file that need to be compiled and starts a local server
    grunt.registerTask('server', ['clean:server', 'sass', 'connect', 'watch']);

    grunt.registerTask('build', ['clean:dist', 'sass', 'useminPrepare', 'concat', 'copy', 'rev:css', 'usemin:css', 'rev:html', 'usemin:html']);
};