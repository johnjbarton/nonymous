Function Object Creation for Naming Anonymous JavaScript Functions, in Uglify

http://code.google.com/p/querypoint-debugging/downloads/detail?name=NamingJSFunctions.pdf

The subdirectories use fake get submodule:
http://debuggable.com/posts/git-fake-submodules:4b563ee4-f3cc-4061-967e-0e48cbdd56cb

uglify:
git clone https://github.com/johnjbarton/UglifyJS.git 
git checkout v1.0.6
git add UglifyJS/
----------------^ Note slash

transformjs, forked, then fake subproject:
git clone git@github.com:johnjbarton/transformjs.git
git add transformjs/

put-selector, forked then fake subproject:
git clone git@github.com:johnjbarton/put-selector.git
git add put-selector/
