/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var debug = require('debug')('dnsjs:utils')

var ipaddr = require('ipaddr.js')

/* Utils
============================================================================= */

var isValidName = function(name) {
    return !!name.match(/[a-z0-9-]*/)
}

var isValidService = function(name) {
    return !!name.match(/_[a-z0-9-]*/)
}

var transformDomainName = function(name, base, callback) {
    var names = name.split('.')
    var gtld = names[names.length - 1]
    var path = names.slice(0, names.length - 1)
    if (gtld == '@') {
        return callback(null, path.concat(base.split('.')).join('.'))
    } else
    if (gtld === '') {
        return callback(null, path.join('.'))
    } else {
        //return callback(new Error('Invalid domain name: ' + name))
        return callback(null, names.concat(base.split('.')).join('.'))
    }
}

var splitServiceName = function(name, callback) {
    var names = name.split('.')
    if (names.length >= 3) {
        if (!isValidService(names[0])) {
            return callback(new Error('Invalid service name: ' + names[0]))
        }
        if (!isValidService(names[1])) {
            return callback(new Error('Invalid protocol name: ' + names[1]))
        }
        return callback(null, names[0].substring(1), names[1].substring(1), names.slice(2).join('.'))
    } else {
        callback(new Error('Invalid service name: ' + name))
    }
}

var reverseIp = function(ip) {
    var address, kind, reverseip, parts;
    
    address = ipaddr.parse(ip.split(/%/)[0]);
    kind = address.kind();

    switch (kind) {
        case 'ipv4':
            address = address.toByteArray();
            address.reverse();
            reverseip = address.join('.') + '.in-addr.arpa';
            break;
        case 'ipv6':
            parts = [];
            address.toNormalizedString().split(':').forEach(function(part) {
                var i, pad = 4 - part.length;
                for (i = 0; i < pad; i++) {
                    part = '0' + part;
                }
                part.split('').forEach(function(p) {
                    parts.push(p);
                });
            });
            parts.reverse();
            reverseip = parts.join('.') + '.ip6.arpa';
            break;
    }

    return reverseip;
};

/* Module
============================================================================= */

var Module = function() {
    this.isValidName = isValidName
    this.isValidService = isValidService
    this.transformDomainName = transformDomainName
    this.splitServiceName = splitServiceName
    this.reverseIp = reverseIp
}

module.exports = new Module()
