#ifndef PROCESS_UTIL_HPP
#define PROCESS_UTIL_HPP

#include <string>
#include <vector>

// Runs a program directly (no shell).
// Returns the exit code, 127 if the program was not found, -1 on failure.
//   input       -> written to the child's stdin
//   output      -> receives the child's stdout
//   mergeStderr -> stderr goes into 'output' too
int runProcess(const std::vector<std::string>& args,
               const std::string* input = nullptr,
               std::string* output = nullptr,
               bool mergeStderr = false);

#endif