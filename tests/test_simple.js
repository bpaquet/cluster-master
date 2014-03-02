
var child_process = require('child_process'),
  net = require('net'),
  fs = require('fs'),
  http = require('http'),
  assert = require('assert');

function run(cmd, display_stderr, callback) {
  if (fs.existsSync('tests/toto.log')) {
    fs.unlinkSync('tests/toto.log');
  }

  var child = child_process.spawn('node', cmd.split(/ /), {cwd: 'tests'});
  child.stdout.on('data', function(data) {
    console.log('[stdout]', data.toString().trim());
  });
  child.stderr.on('data', function(data) {
    if (display_stderr) {
      console.log('[stderr]', data.toString().trim());
    }
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
  var out = [];
  var timeout = setTimeout(function() {
    console.log('Unable to read from repl', out);
  }, 200);
  var c = net.connect({path: 'tests/cluster-master-socket'}, true, function() {
    c.write('console.log("##" + JSON.stringify(workers) + "##");\n');
    c.on('data', function(d) {
      var dd = d.toString();
      out.push(dd);
      var res = dd.match(/##(\[.*\])##/);
      if (res) {
        try {
          callback(JSON.parse(res[1]));
          clearTimeout(timeout);
        }
        catch(e) {
          console.log(e, dd);
          assert.ifError(e);
        }
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

var k = process.env.k || 30;
describe('Simple', function() {

  it('Kill', function(done) {
    var child = run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 143);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g), null);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g), null);
      done();
    });
    setTimeout(function() {
      assertListening(5, function() {
        child.kill();
      });
    }, 500);
  });

  it('Quit with repl', function(done) {
    run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 5);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/Restarting all workers/g), null);
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
    run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 1);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 4);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g), null);
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
    run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 6);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 6);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g), null);
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
    run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 10);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 10);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g).length, 1);
      done();
    });
    setTimeout(function() {
      assertListening(5, function() {
        sendRepl('restart();', function() {
          setTimeout(function() {
            assertListening(5, function(d) {
              for(var i in d) {
                assert(d[i].id > 4);
              }
              sendRepl('stop();', function() {
              });
            });
          }, 1000);
        });
      });
    }, 500);
  });

  it(k + ' Restart', function(done) {
    run('master.js --log_file toto.log', true, function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, (k + 1) * 5);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, (k + 1) * 5);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g).length, k);
      done();
    });
    var counter = k;
    var f = function() {
      setTimeout(function() {
        if (counter === 0) {
          return sendRepl('stop();', function() {
          });
        }
        assertListening(5, function() {
          sendRepl('restart();', function() {
            counter -= 1;
            f();
          });
        });
      }, 1000);
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
      assert.equal(log.match(/died too quickly/g), null);
      assert.equal(log.match(/Restarting all workers/g).length, 1);
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

  it('Crash at start', function(done) {
    run('master.js --log_file toto.log --parse_now toto.json', false, function(code) {
      assert.equal(code, 0);
      var log = logs();
      assert.equal(log.match(/Start worker (\d+)/g).length, 10);
      assert.equal(log.match(/Worker (\d+) disconnect/g).length, 10);
      assert.equal(log.match(/died too quickly/g).length, 10);
      assert.equal(log.match(/Bye (\d+)/g), null);
      assert.equal(log.match(/Restarting all workers/g), null);
      done();
    });
    setTimeout(function() {
      assertListening(0, function() {
        sendRepl('stop();', function() {
        });
      });
    }, 1500);
  });

});