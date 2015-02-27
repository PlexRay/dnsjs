/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/
/*jshint -W030 */

var test = global.unitjs || require('unit.js'),
    util = require('util'),
    should = test.should
    
var dnsjs = require('../lib/index.js')

/* Tests
============================================================================= */

describe('[0002] Utils', function() {

    it('[0000] "@", "domain.bit" => "domain.bit"', function(done) {
        dnsjs.utils.transformDomainName('@', 'domain.bit', function(err, res) {
            if (err) { return done(err) }

            res.should.be.type('string')
            res.should.equal('domain.bit')

            done()
        })
    })

    it('[0020] "www.@", "domain.bit" => "www.domain.bit"', function(done) {
        dnsjs.utils.transformDomainName('www.@', 'domain.bit', function(err, res) {
            if (err) { return done(err) }

            res.should.be.type('string')
            res.should.equal('www.domain.bit')

            done()
        })
    })

    it('[0040] "example.bit.", "domain.bit" => "example.bit"', function(done) {
        dnsjs.utils.transformDomainName('example.bit.', 'domain.bit', function(err, res) {
            if (err) { return done(err) }

            res.should.be.type('string')
            res.should.equal('example.bit')

            done()
        })
    })

    it('[0060] "example", "domain.bit" => "example.domain.bit"', function(done) {
        dnsjs.utils.transformDomainName('example', 'domain.bit', function(err, res) {
            if (err) { return done(err) }

            res.should.be.type('string')
            res.should.equal('example.domain.bit')

            done()
        })
    })

    it('[0080] reverseIp("127.0.0.1")', function(done) {
        
        var ip = dnsjs.utils.reverseIp("127.0.0.1")

        ip.should.be.type('string')
        ip.should.equal('1.0.0.127.in-addr.arpa')

        done()
    })

    it('[0100] reverseIp("2001:4860:4860::8844")', function(done) {
        
        var ip = dnsjs.utils.reverseIp('2001:4860:4860::8844')

        ip.should.be.type('string')
        ip.should.equal('4.4.8.8.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.6.8.4.0.6.8.4.1.0.0.2.ip6.arpa')

        done()
    })
})