(function($){

	var secureFlag = false;
	if (document.location.origin.indexOf('https') === 0) {
		secureFlag = true;
	}
    esock = io.connect( document.location.origin, {secure: secureFlag} );

    $.fn.callService = function (serviceName, serviceData, successCallback, options) {
        var callService = function (serviceName, serviceData, successCallback) {
            var type = 'GET';
            var data = {};
            var serviceUrl = (options && options.url) ? options.url : 'service';
            if (serviceData && typeof serviceData === 'object') {
                type = 'POST';
                data = serviceData;
            } else {
                successCallback = serviceData;
            }
            $.ajax({
                type: type,
                url: serviceUrl + '/' + serviceName,
                data: JSON.stringify(data),
                context: document.body
            }).done(function(response) {
                    if (successCallback) {
                        successCallback(response);
                    }
                });
        };
        callService(serviceName, serviceData, successCallback);
        return this;
    };

    $.fn.initSocket = function (callback) {
        esock.on('connect', function () {
            callback();
        });
    };

    $.fn.callSocket = function (serviceName, serviceData, successCallback) {
        esock.emit(serviceName, serviceData);
        esock.on(serviceName, function (data) {
            successCallback(data);
        });
    };

})(jQuery);
