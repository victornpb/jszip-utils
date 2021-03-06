'use strict';

var JSZipUtils = {};
// just use the responseText with xhr1, response with xhr2.
// The transformation doesn't throw away high-order byte (with responseText)
// because JSZip handles that case. If not used with JSZip, you may need to
// do it, see https://developer.mozilla.org/En/Using_XMLHttpRequest#Handling_binary_data
JSZipUtils._getBinaryFromXHR = function (xhr) {
    // for xhr.responseText, the 0xFF mask is applied by JSZip
    return xhr.response || xhr.responseText;
};

// taken from jQuery
function createStandardXHR() {
    try {
        return new window.XMLHttpRequest();
    } catch( e ) {}
}

function createActiveXHR() {
    try {
        return new window.ActiveXObject("Microsoft.XMLHTTP");
    } catch( e ) {}
}

// Create the request object
var createXHR = (typeof window !== "undefined" && window.ActiveXObject) ?
    /* Microsoft failed to properly
     * implement the XMLHttpRequest in IE7 (can't request local files),
     * so we use the ActiveXObject when it is available
     * Additionally XMLHttpRequest can be disabled in IE7/IE8 so
     * we need a fallback.
     */
    function() {
    return createStandardXHR() || createActiveXHR();
} :
    // For all other browsers, use the standard XMLHttpRequest object
    createStandardXHR;



JSZipUtils.getBinaryContent = function (path, options) {

    var promise, resolve, reject;
    var callback;

    // backward compatible callback
    if (typeof options === "function") {
        callback = options;
        options = {};
    }
    // callback inside options object
    else if (typeof options === 'object' && options && typeof options.callback === 'function') {
        callback = options.callback;
    }

    if (!callback) {
        promise = new window.Promise(function (_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });
    }
    else {
        resolve = function (data) { callback(null, data); };
        reject = function (err) { callback(err, null); };
    }
    
    if (!options) options = {};
    /*
     * Here is the tricky part : getting the data.
     * In firefox/chrome/opera/... setting the mimeType to 'text/plain; charset=x-user-defined'
     * is enough, the result is in the standard xhr.responseText.
     * cf https://developer.mozilla.org/En/XMLHttpRequest/Using_XMLHttpRequest#Receiving_binary_data_in_older_browsers
     * In IE <= 9, we must use (the IE only) attribute responseBody
     * (for binary data, its content is different from responseText).
     * In IE 10, the 'charset=x-user-defined' trick doesn't work, only the
     * responseType will work :
     * http://msdn.microsoft.com/en-us/library/ie/hh673569%28v=vs.85%29.aspx#Binary_Object_upload_and_download
     *
     * I'd like to use jQuery to avoid this XHR madness, but it doesn't support
     * the responseType attribute : http://bugs.jquery.com/ticket/11461
     */
    try {

        var xhr = createXHR();

        xhr.open('GET', path, true);

        // recent browsers
        if ("responseType" in xhr) {
            xhr.responseType = "arraybuffer";
        }

        // older browser
        if(xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        }

        xhr.onreadystatechange = function(event) {
            var file, err;
            // use `xhr` and not `this`... thanks IE
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    file = null;
                    err = null;
                    try {
                        file = JSZipUtils._getBinaryFromXHR(xhr);
                        resolve(file);
                    } catch(rr) {
                        err = new Error(rr);
                        reject(err);
                    }
                } else {
                    reject(new Error("Ajax error for " + path + " : " + this.status + " " + this.statusText));
                }
            }
        };
        
        if(options.progress) {
            xhr.onprogress = function(e) {
                options.progress({
                    path: path,
                    originalEvent: e,
                    percent: e.loaded / e.total * 100,
                    downloaded: e.loaded,
                    size: e.total,
                    loaded: e.loaded,
                    total: e.total
                });
            };
        }

        xhr.send();

    } catch (e) {
        reject(new Error(e), null);
    }

    return promise; // returns a promise or undefined if provided callback
};

// export
module.exports = JSZipUtils;

// enforcing Stuk's coding style
// vim: set shiftwidth=4 softtabstop=4:
