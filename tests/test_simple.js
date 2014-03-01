
var child_process = require('child_process'),
  net = require('net'),
  fs = require('fs'),
  http = require('http'),
  assert = require('assert');

function run(cmd, callback) {
  if (fs.existsSync('tests/toto.log')) {
    fs.unlinkSync('tests/toto.log');
  }

  var child = child_process.spawn('node', cmd.split(/ /), {cwd: 'tests'});
  child.stdout.on('data', function(data) {
    console.log('[stdout]', data.toString().trim());
  });
  child.stderr.on('data', function(data) {
    console.log('[stderr]', data.toString().trim());
  });
  child.on('exit', function(code) {
    callback(code);
  });
  return child;
}

function logs() {
  return fs.readFileSync('tests/toto.log').toString();
}

function sendRepl(command, callback) {
  var c = net.connect({path: 'tests/cluster-master-socket'}, function() {
    c.write(command + '\n');
    c.end();
    callback();
  });
}

function readWorkers(callback) {
  var c = net.connect({path: 'tests/cluster-master-socket'}, function() {
    c.write('console.log(JSON.stringify(workers));\n');
    c.on('data', function(d) {
      if (d.toString().match(/\{"/)) {
        callback(JSON.parse(d.toString()));
        c.end();
      }
    });
  });
}

function assertListening(x, callback) {
  readWorkers(function(d) {
    assert.equal(Object.keys(d).length, x);
    for(var i in d) {
      assert.equal(d[i].state, 'listening');
    }
    callback(d);
  });
}

describe('Simple', function() {

  it('Kill', function(done) {
    var child = run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 143);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g), null);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      assertListening(5, function() {
        child.kill();
      });
    }, 500);
  });

  it('Quit with repl', function(done) {
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 5);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      assertListening(5, function() {
        sendRepl('stop();', function() {
        });
      });
    }, 500);
  });

  it('Quit with current connection', function(done) {
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 1);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 4);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      http.get('http://localhost:8078/toto', function(res) {
        assert.equal(res.statusCode, 200);
        assertListening(5, function() {
          sendRepl('stop();', function() {
            setTimeout(function() {
              assertListening(1, function() {
                sendRepl('kill();', function() {
                });
              });
            }, 500);
          });
        });
      });
    }, 500);
  });

  it('Worker crash', function(done) {
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 6);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 6);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      http.get('http://localhost:8078/crash', function() {
      }).on('error', function() {
        setTimeout(function() {
          assertListening(5, function(d) {
            var count = 0;
            for(var i in d) {
              if (d[i].age < 500) {
                count += 1;
              }
            }
            assert.equal(count, 1);
            sendRepl('stop();', function() {
            });
          });
        }, 200);
      });
    }, 500);
  });

  it('Restart', function(done) {
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 10);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 10);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      assertListening(5, function() {
        sendRepl('restart();', function() {
          setTimeout(function() {
            assertListening(5, function() {
              sendRepl('stop();', function() {
              });
            });
          }, 1000);
        });
      });
    }, 500);
  });

  it('20 Restart', function(done) {
    var k = 20;
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, k * 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, k * 5);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    var counter = k;
    var f = function() {
      setTimeout(function() {
        if (counter === 1) {
          return sendRepl('stop();', function() {
          });
        }
        assertListening(5, function() {
          sendRepl('restart();', function() {
            counter -= 1;
            f();
          });
        });
      }, 800);
    };
    f();
  });

  it('Restart with connection', function(done) {
    run('master.js --log_file toto.log', function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 10);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 10);
      assert.equal(log.match(/Bye (\d+)/g), null);
      done();
    });
    setTimeout(function() {
      http.get('http://localhost:8078/toto', function(res) {
        assert.equal(res.statusCode, 200);
        assertListening(5, function() {
          sendRepl('restart();', function() {
            setTimeout(function() {
              assertListening(6, function() {
                res.client.end();
                setTimeout(function() {
                  assertListening(5, function() {
                    sendRepl('stop();', function() {
                    });
                  });
                }, 200);
              });
            }, 1000);
          });
        });
      });
    }, 500);
  });

});