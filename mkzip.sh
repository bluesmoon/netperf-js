VERSION=`awk '/^	version: ".*",/ { print $2; }' bw-test.js | sed -e 's/[^a-zA-Z0-9\.-]//g'`
zip -r bw-test-$VERSION.zip bw-test.js image*.png image-l.gif README tests/*.html
