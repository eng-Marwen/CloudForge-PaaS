#include "processUtil.hpp"

#include <cerrno>
#include <csignal>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

namespace {
void closeFd(int fd) { if (fd >= 0) close(fd); }
}

int runProcess(const std::vector<std::string>& args,
               const std::string* input,
               std::string* output,
               bool mergeStderr)
{
    // Writing to a child that already exited must not kill the core.
    std::signal(SIGPIPE, SIG_IGN);

    int inPipe[2]  = {-1, -1};
    int outPipe[2] = {-1, -1};

    if (input && pipe(inPipe) < 0) return -1;

    if (output && pipe(outPipe) < 0) {
        closeFd(inPipe[0]); closeFd(inPipe[1]);
        return -1;
    }

    pid_t pid = fork();

    if (pid < 0) {
        closeFd(inPipe[0]);  closeFd(inPipe[1]);
        closeFd(outPipe[0]); closeFd(outPipe[1]);
        return -1;
    }

    if (pid == 0) {
        if (input) {
            dup2(inPipe[0], STDIN_FILENO);
            close(inPipe[0]); close(inPipe[1]);
        }
        if (output) {
            dup2(outPipe[1], STDOUT_FILENO);
            if (mergeStderr) dup2(outPipe[1], STDERR_FILENO);
            close(outPipe[0]); close(outPipe[1]);
        }

        std::vector<char*> argv;
        for (const auto& a : args) argv.push_back(const_cast<char*>(a.c_str()));
        argv.push_back(nullptr);

        execvp(argv[0], argv.data());
        _exit(127);
    }

    if (input) {
        close(inPipe[0]);

        size_t written = 0;
        while (written < input->size()) {
            ssize_t n = write(inPipe[1], input->data() + written,
                              input->size() - written);
            if (n < 0) { if (errno == EINTR) continue; break; }
            written += static_cast<size_t>(n);
        }

        close(inPipe[1]);
    }

    if (output) {
        close(outPipe[1]);

        char buffer[4096];
        ssize_t n;
        while ((n = read(outPipe[0], buffer, sizeof(buffer))) != 0) {
            if (n < 0) { if (errno == EINTR) continue; break; }
            output->append(buffer, static_cast<size_t>(n));
        }

        close(outPipe[0]);
    }

    int status = 0;

    while (waitpid(pid, &status, 0) < 0) {
        if (errno == EINTR) continue;
        return -1;
    }

    return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}