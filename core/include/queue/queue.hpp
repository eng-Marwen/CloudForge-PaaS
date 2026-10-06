#ifndef QUEUE_HPP
#define QUEUE_HPP

#include <string>

class Queue
{
private:
    std::string queueName;

public:
    explicit Queue(const std::string& queueName);

    void consume();
};

#endif

// The .hpp file is the interface/declaration of the class.

// It tells the compiler:

// "There is a class called Queue. It contains this data and these functions."

// It does not tell the compiler how consume() works yet.