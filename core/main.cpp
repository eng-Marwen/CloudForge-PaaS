#include "queue.hpp"

int main()
{
    Queue queue("deploy.events");

    queue.consume();

    return 0;
}

