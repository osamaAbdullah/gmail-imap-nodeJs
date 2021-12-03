const path = require('path');
const express = require('express');
const Imap = require('imap');
const inspect = require('util').inspect;

require('dotenv').config({path: './.env'});
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
const app = express();
app.use(require('./app/middleware/logger').logger);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {

    const imap = new Imap({
        user: 'your.email@gmail.com',
        password: 'password',
        host: 'imap.gmail.com',
        port: 993,
        tls: true
    });

    function openInbox(cb) {
        imap.openBox('INBOX', true, cb);
    }

    imap.once('ready', function() {
        openInbox(function(err, box) {
            if (err) throw err;
            var f = imap.seq.fetch(box.messages.total + ':*', { bodies: ['HEADER.FIELDS (FROM)','TEXT'] });
            f.on('message', function(msg, seqno) {
                console.log('Message #%d', seqno);
                var prefix = '(#' + seqno + ') ';
                msg.on('body', function(stream, info) {
                    if (info.which === 'TEXT')
                        console.log(prefix + 'Body [%s] found, %d total bytes', inspect(info.which), info.size);
                    var buffer = '', count = 0;
                    stream.on('data', function(chunk) {
                        count += chunk.length;
                        buffer += chunk.toString('utf8');
                        if (info.which === 'TEXT')
                            console.log(prefix + 'Body [%s] (%d/%d)', inspect(info.which), count, info.size);
                    });
                    stream.once('end', function() {
                        if (info.which !== 'TEXT')
                            console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                        else
                            console.log(prefix + 'Body [%s] Finished', inspect(info.which));
                    });
                });
                msg.once('attributes', function(attrs) {
                    console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
                });
                msg.once('end', function() {
                    console.log(prefix + 'Finished');
                });
            });
            f.once('error', function(err) {
                console.log('Fetch error: ' + err);
            });
            f.once('end', function() {
                console.log('Done fetching all messages!');
                imap.end();
            });
        });
    });

    imap.once('error', function(err) {
        console.log(err);
    });

    imap.once('end', function() {
        console.log('Connection ended');
    });

    imap.connect();

    res.json('req.body');
});

app.listen(
    process.env.PORT,
    _ => console.log(
        '\x1b[36m',
        `Server running in ${process.env.NODE_ENV} mode on port ${process.env.PORT}`
    )
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log('\x1b[1m', `Error: ${err.message}`);
    // Close server & exit process
    // server.close(() => process.exit(1));
});